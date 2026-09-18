"""
Allternit Computer Use — Shadow Head Eval Harness

Drives ``PlanningLoop`` over synthetic task observations to score the shadow
decision head against the LLM decide step WITHOUT any network, model, or
browser dependency:

- the LLM provider is ``ScriptedVisionProvider`` — it replays recorded
  answers (the "LLM transcript") with scripted latency;
- the AX observation is ``ScriptedInspector`` — a scripted stand-in for
  ``AccessibilityInspector`` returning deterministic AccessibilityNode trees
  (the replay engine re-executes recordings without a decide step, so the
  harness drives the planning loop over synthetic observations instead —
  the cheapest correct option, per the MAP);
- the head is ``MockHead`` with a scripted opinion transcript (stand-in for
  the mlx-lm direct-logit head, which needs weights this harness must not
  download).

Agreement numbers produced here are therefore PLUMBING numbers: they verify
the eval path end-to-end deterministically and offline. Real head-vs-LLM
agreement requires the mlx head weights (Phase 1 ships the head but does not
download weights in-session).

Report: head vs LLM decide-step latency, agreement rate, and agreement
conditioned on LLM step success/failure, over >=20 decide steps per task
across >=3 tasks. ``python scripts/shadow_head_eval.py`` writes JSON +
markdown reports.
"""

from __future__ import annotations

import copy
import json
import logging
import os
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

from .decision_head import DecisionHead, MockHead, Question, TypedDecision
from .element_table import build_element_table
from .planning_loop import PlanningLoop, PlanningLoopConfig
from .vision_providers import ActionPlan, VisionAction

logger = logging.getLogger(__name__)

# 1x1 transparent PNG — adapter screenshot bytes so the loop never falls
# back to host display capture.
_TINY_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d494844520000000100000001080600000"
    "01f15c4890000000d49444154789c626001000000ffff030000060005"
    "57bfabd40000000049454e44ae426082"
)

# Planning-loop action types → whitelist methods (aligned with
# core/batch_dispatch.py; Rust BATCH_ACTION_WHITELIST is authoritative).
_LLM_OP_MAP = {
    "click": "click",
    "double_click": "doubleClick",
    "fill": "fill",
    "type": "fill",
    "select": "selectOptionFromDropdown",
    "scroll": "scrollTo",
    "key": "press",
}

# Operations whose agreement check also requires a target match.
_TARGET_OPS = frozenset({"click", "fill", "selectOptionFromDropdown", "hover", "doubleClick"})

DEFAULT_STEPS_PER_TASK = 22
DEFAULT_HEAD_LATENCY_MS = 8.0
DEFAULT_LLM_LATENCY_MS = 850.0


# ---------------------------------------------------------------------------
# Scripted LLM provider (recorded answers, scripted latency)
# ---------------------------------------------------------------------------

@dataclass
class ScriptedTurn:
    """One recorded LLM decide-step answer."""
    action_type: str
    target: str = ""
    text: Optional[str] = None
    latency_ms: float = DEFAULT_LLM_LATENCY_MS


class ScriptedVisionProvider:
    """Replays a recorded LLM transcript through the VisionProvider shape."""

    def __init__(self, turns: Sequence[ScriptedTurn]) -> None:
        self._turns = list(turns)
        self._index = 0
        self.calls: List[Dict[str, Any]] = []

    async def ground_and_reason(
        self,
        screenshot_b64: str = "",
        task: str = "",
        history: Optional[List[str]] = None,
    ) -> ActionPlan:
        if self._index < len(self._turns):
            turn = self._turns[self._index]
            self._index += 1
            self.calls.append({"latency_ms": turn.latency_ms, "turn": turn})
            return ActionPlan(
                reasoning=f"scripted turn {self._index}",
                plan_steps=[task],
                immediate_action=VisionAction(
                    type=turn.action_type,
                    target=turn.target,
                    reason="recorded",
                    text=turn.text,
                ),
                confidence=0.9,
                done=False,
            )
        # Transcript exhausted: the task is complete.
        self.calls.append({"latency_ms": 1.0, "turn": None})
        return ActionPlan(
            reasoning="scripted transcript exhausted — task complete",
            plan_steps=[],
            immediate_action=VisionAction(type="done", target="", reason=""),
            confidence=1.0,
            done=True,
        )


# ---------------------------------------------------------------------------
# Scripted adapter + inspector
# ---------------------------------------------------------------------------

class _FakeResult:
    def __init__(self, succeeded: bool, url: str) -> None:
        self.status = "completed" if succeeded else "failed"
        self.extracted_content = {"url": url, "content": "synthetic page"}

    def to_dict(self) -> Dict[str, Any]:
        return {"status": self.status, "extracted_content": self.extracted_content}


class ScriptedAdapter:
    """Deterministic adapter: records executed actions, fails scripted targets."""

    def __init__(self, fail_targets: Sequence[str] = (), url: str = "https://eval.local/page") -> None:
        self._fail_targets = set(fail_targets)
        self._url = url
        self.executed: List[Tuple[str, str]] = []

    async def screenshot(self, session_id: str) -> bytes:
        return _TINY_PNG

    async def execute(self, req: Any) -> _FakeResult:
        target = getattr(req, "target", "") or ""
        self.executed.append((getattr(req, "action_type", ""), target))
        if target in self._fail_targets:
            raise RuntimeError(f"scripted adapter failure for target {target!r}")
        return _FakeResult(True, self._url)


class ScriptedInspector:
    """Deterministic AccessibilityInspector stand-in (scripted AX trees)."""

    def __init__(self, trees: Sequence[Any]) -> None:
        self._trees = list(trees)
        self._calls = 0

    async def is_available(self) -> bool:
        return True

    async def snapshot(self, skeleton: bool = True) -> Any:
        index = min(self._calls, len(self._trees) - 1)
        self._calls += 1
        # RefMap.apply_to_tree mutates nodes — hand back a fresh copy per call.
        return copy.deepcopy(self._trees[index])

    def _to_tree_text(self, root: Any) -> str:
        return "[scripted ax tree]"

    async def get_coordinate_contract(self) -> Any:
        from .accessibility_inspector import CoordinateContract

        return CoordinateContract()


# ---------------------------------------------------------------------------
# Synthetic tasks
# ---------------------------------------------------------------------------

def _node(
    role: str,
    name: str,
    children: Optional[List[Any]] = None,
    interactive: bool = False,
    value: str = "",
) -> Any:
    from .accessibility_inspector import AccessibilityNode

    return AccessibilityNode(
        role=role,
        name=name,
        value=value,
        children=children or [],
        is_interactive=interactive,
    )


@dataclass
class SyntheticTask:
    """One eval task: a recorded LLM transcript + scripted observation."""
    task_id: str
    task: str
    tree: Any                                   # base AX observation
    turns: List[ScriptedTurn]                   # recorded LLM answers
    fail_targets: List[str] = field(default_factory=list)


def _search_task(steps: int) -> SyntheticTask:
    pattern = [
        ScriptedTurn("fill", "Search query", text="quarterly report"),
        ScriptedTurn("click", "Search"),
        ScriptedTurn("click", "First result"),
    ]
    tree = _node("AXWindow", "EvalBrowser", [
        _node("AXTextField", "Search query", interactive=True),
        _node("AXButton", "Search", interactive=True),
        _node("AXScrollArea", "Results", [
            _node("AXLink", "First result", interactive=True),
            _node("AXLink", "Second result", interactive=True),
        ], interactive=True),
        _node("AXStaticText", "Results for: quarterly report"),
    ])
    return SyntheticTask(
        task_id="search-flow",
        task="Search for 'quarterly report' and open the first result",
        tree=tree,
        turns=[copy.deepcopy(pattern[i % len(pattern)]) for i in range(steps)],
        fail_targets=["First result"],
    )


def _form_task(steps: int) -> SyntheticTask:
    pattern = [
        ScriptedTurn("fill", "Email", text="operator@eval.local"),
        ScriptedTurn("fill", "Password", text="hunter2"),
        ScriptedTurn("click", "Submit"),
    ]
    tree = _node("AXWindow", "EvalBrowser", [
        _node("AXTextField", "Email", interactive=True),
        _node("AXTextField", "Password", interactive=True),
        _node("AXCheckBox", "Remember me", interactive=True),
        _node("AXButton", "Submit", interactive=True),
        _node("AXLink", "Forgot password", interactive=True),
    ])
    return SyntheticTask(
        task_id="form-fill",
        task="Log in with the saved operator credentials",
        tree=tree,
        turns=[copy.deepcopy(pattern[i % len(pattern)]) for i in range(steps)],
        fail_targets=["Submit"],
    )


def _settings_task(steps: int) -> SyntheticTask:
    pattern = [
        ScriptedTurn("click", "Theme"),
        ScriptedTurn("click", "Notifications"),
        ScriptedTurn("click", "Save"),
    ]
    tree = _node("AXWindow", "EvalBrowser", [
        _node("AXPopUpButton", "Theme", interactive=True),
        _node("AXCheckBox", "Notifications", interactive=True),
        _node("AXButton", "Save", interactive=True),
        _node("AXLink", "Back to profile", interactive=True),
        _node("AXScrollArea", "Settings panel", interactive=True),
    ])
    return SyntheticTask(
        task_id="settings-toggle",
        task="Enable notifications and save the settings",
        tree=tree,
        turns=[copy.deepcopy(pattern[i % len(pattern)]) for i in range(steps)],
        fail_targets=["Notifications"],
    )


def default_tasks(steps_per_task: int = DEFAULT_STEPS_PER_TASK) -> List[SyntheticTask]:
    """The three synthetic recorded tasks (>=20 decide steps each by default)."""
    return [
        _search_task(steps_per_task),
        _form_task(steps_per_task),
        _settings_task(steps_per_task),
    ]


# ---------------------------------------------------------------------------
# Scripted shadow head (MockHead with a deterministic opinion transcript)
# ---------------------------------------------------------------------------

def _parse_table_rows(state_text: str) -> List[Tuple[str, str, str]]:
    """Parse ``[<ref>] <role>: <name>`` lines from the shadow state text."""
    rows = []
    for line in state_text.splitlines():
        line = line.strip()
        if not (line.startswith("[") and "] " in line and ": " in line):
            continue
        ident, rest = line[1:].split("] ", 1)
        role, name = rest.split(": ", 1)
        rows.append((ident, role, name))
    return rows


def scripted_head(
    task: SyntheticTask,
    disagree_every: int = 5,
    latency_ms: float = DEFAULT_HEAD_LATENCY_MS,
) -> DecisionHead:
    """A MockHead that mirrors the LLM transcript, disagreeing deterministically
    every ``disagree_every``-th action step (a different target when one is
    available, otherwise a different operation). Also answers the goal/stuck
    gate questions: stuck on the steps whose target the scripted adapter will
    fail, goal_satisfied on the final action step. Stands in for the real
    head; agreement numbers are plumbing numbers, not model quality."""
    opinions: List[Tuple[str, str]] = []
    for i, turn in enumerate(task.turns):
        op = _LLM_OP_MAP.get(turn.action_type, turn.action_type)
        target = turn.target
        if disagree_every > 0 and (i + 1) % disagree_every == 0:
            others = [t.target for t in task.turns if t.target and t.target != target]
            if others:
                target = others[i % len(others)]
            else:
                op = "scrollTo" if op != "scrollTo" else "click"
        opinions.append((op, target))

    fail_steps = {
        i for i, turn in enumerate(task.turns) if turn.target in set(task.fail_targets)
    }
    state = {"i": 0}

    def chooser(question: Question, state_text: str) -> str:
        # State-text table lines are emitted in row order, so the Nth parsed
        # line is row index N-1 — the vocabulary target options are indices.
        rows = _parse_table_rows(state_text)
        if question.name == "operation":
            i = min(state["i"], len(opinions) - 1)
            state["i"] += 1
            state["current"] = i  # gate/target questions in THIS pass use step i
            op, _ = opinions[i]
            return op if op in question.options else question.options[0]
        i = min(state.get("current", 0), len(opinions) - 1)
        if question.name == "goal_satisfied":
            return "true" if i == len(opinions) - 1 else "false"
        if question.name == "stuck":
            return "true" if i in fail_steps else "false"
        # <operation>_target: resolve the scripted target name to its row index.
        _, target = opinions[i]
        for index, (_ident, _role, name) in enumerate(rows):
            if name.strip() == target and str(index) in question.options:
                return str(index)
        return question.options[0]

    return MockHead(
        chooser=chooser,
        latency_ms=latency_ms,
        confidence=0.8,
        model_id="mock-scripted-head",
    )


# ---------------------------------------------------------------------------
# Harness
# ---------------------------------------------------------------------------

def _patch_inspector(trees: Sequence[Any]) -> Tuple[Any, Callable[[], Any]]:
    """Swap AccessibilityInspector for a scripted factory; returns restore()."""
    import core.accessibility_inspector as inspector_mod

    original = inspector_mod.AccessibilityInspector

    def factory() -> ScriptedInspector:
        return ScriptedInspector(trees)

    inspector_mod.AccessibilityInspector = factory  # type: ignore[assignment]

    def restore() -> None:
        inspector_mod.AccessibilityInspector = original

    return factory, restore


def _step_trees(task: SyntheticTask) -> List[Any]:
    """Initial tree + one variant per action turn (fill values appear)."""
    trees = [copy.deepcopy(task.tree)]
    pending_value: Optional[Tuple[str, str]] = None
    for turn in task.turns:
        tree = copy.deepcopy(task.tree)
        if pending_value is not None:
            field_name, value = pending_value
            _set_field_value(tree, field_name, value)
        trees.append(tree)
        if turn.action_type in ("fill", "type") and turn.text:
            pending_value = (turn.target, turn.text)
    return trees


def _set_field_value(node: Any, name: str, value: str) -> None:
    if getattr(node, "name", "") == name and getattr(node, "role", "") in (
        "AXTextField", "AXTextArea",
    ):
        node.value = value
    for child in getattr(node, "children", []) or []:
        _set_field_value(child, name, value)


def run_task_sync(
    task: SyntheticTask,
    head: Optional[DecisionHead] = None,
    max_elements: int = 250,
    step_budget_ms: int = 15_000,
    progress: bool = False,
) -> Dict[str, Any]:
    """Sync wrapper around :func:`run_task` (fresh event loop)."""
    import asyncio

    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(
            run_task(task, head=head, max_elements=max_elements,
                     step_budget_ms=step_budget_ms, progress=progress)
        )
    finally:
        loop.close()


async def run_task(
    task: SyntheticTask,
    head: Optional[DecisionHead] = None,
    max_elements: int = 250,
    step_budget_ms: int = 15_000,
    progress: bool = False,
) -> Dict[str, Any]:
    """Run one synthetic task through the planning loop and score agreement.

    Returns the per-task report slice: decide-step count, agreement rates
    (overall / given LLM success / given LLM failure) and mean latencies.
    """
    from .element_refs import get_refmap

    get_refmap().clear()
    provider = ScriptedVisionProvider(task.turns)
    adapter = ScriptedAdapter(fail_targets=task.fail_targets)
    shadow_head = head or scripted_head(task)
    step_trees = _step_trees(task)

    # Isolate the disk-backed ACU scratchpad for this eval run: the loop
    # injects scratchpad context into the task text and reflects after the
    # run, so without isolation evals would be nondeterministic across
    # machines AND pollute the operator's real scratchpad.
    scratch_dir = tempfile.mkdtemp(prefix="acu-shadow-eval-")
    prev_scratch_dir = os.environ.get("ACU_SCRATCHPAD_DIR")
    os.environ["ACU_SCRATCHPAD_DIR"] = scratch_dir

    _, restore = _patch_inspector(step_trees)
    events: List[Dict[str, Any]] = []

    def _on_event(event: Dict[str, Any]) -> None:
        events.append(event)
        if progress and event.get("type") == "shadow.decision":
            print(
                f"[{task.task_id}] step {event.get('step')} "
                f"head={event.get('head')} latency={event.get('latency_ms'):.0f}ms",
                flush=True,
            )

    try:
        loop = PlanningLoop(
            vision_provider=provider,
            adapter=adapter,
            config=PlanningLoopConfig(
                max_steps=len(task.turns) + 2,
                # Slow heads (mlx ~1s, kimi CLI subprocess ~25-60s per step)
                # must surface as a metric, not a silent mid-run timeout —
                # scale the wall-clock budget with the transcript and the
                # per-step decide budget.
                timeout_ms=max(120_000, (len(task.turns) + 2) * step_budget_ms),
                approval_policy="never",
                reflect_after_each_step=False,
                batch_enabled=False,
                shadow_head_enabled=True,
                shadow_head_max_elements=max_elements,
                shadow_head=shadow_head,
            ),
            event_callback=_on_event,
        )
        result = await loop.run(task.task, session_id=f"shadow-{task.task_id}")
    finally:
        restore()
        if prev_scratch_dir is None:
            os.environ.pop("ACU_SCRATCHPAD_DIR", None)
        else:
            os.environ["ACU_SCRATCHPAD_DIR"] = prev_scratch_dir

    shadow_events = [e for e in events if e.get("type") == "shadow.decision"]

    steps_report: List[Dict[str, Any]] = []
    llm_success_by_step: Dict[int, bool] = {
        s.step: s.action_succeeded for s in result.steps
    }
    turn_latency_by_step = {
        i + 1: call["latency_ms"] for i, call in enumerate(provider.calls[: len(task.turns)])
    }

    for event in shadow_events:
        step_num = event["step"]
        decision = event["decision"]
        llm_turn = task.turns[step_num - 1] if 0 < step_num <= len(task.turns) else None
        llm_op = _LLM_OP_MAP.get(llm_turn.action_type, llm_turn.action_type) if llm_turn else None

        op_choice = decision["choices"].get("operation", {})
        head_op = op_choice.get("chosen")
        op_agree = head_op == llm_op

        target_agree: Optional[bool] = None
        if llm_op in _TARGET_OPS and head_op == llm_op:
            target_choice = decision["choices"].get(f"{head_op}_target", {})
            head_target = target_choice.get("chosen")
            tree = step_trees[min(step_num, len(step_trees) - 1)]
            table = build_element_table(tree, max_elements=max_elements)
            matched = table.match_target(llm_turn.target if llm_turn else "")
            try:
                target_agree = matched is not None and str(matched) == str(head_target)
            except (TypeError, ValueError):
                target_agree = False

        needs_target = llm_op in _TARGET_OPS
        agreement = op_agree and (target_agree is not False)
        gates: Dict[str, Any] = {}
        for gate in ("goal_satisfied", "stuck"):
            gate_choice = decision["choices"].get(gate, {})
            gate_probs = gate_choice.get("probabilities", {})
            gates[gate] = gate_choice.get("chosen")
            gates[f"{gate}_true_probability"] = gate_probs.get("true")
            gates[f"{gate}_confidence"] = gate_choice.get("confidence", 0.0)
        steps_report.append({
            "step": step_num,
            "llm_op": llm_op,
            "head_op": head_op,
            "op_agree": op_agree,
            "target_agree": target_agree,
            "agreement": agreement,
            "llm_success": llm_success_by_step.get(step_num, True),
            "head_confidence": op_choice.get("confidence", 0.0),
            "head_latency_ms": event["latency_ms"],
            "llm_latency_ms": turn_latency_by_step.get(step_num, 0.0),
            **gates,
        })

    def _rate(rows: List[Dict[str, Any]], key: str = "agreement") -> Optional[float]:
        return round(sum(1 for r in rows if r[key]) / len(rows), 4) if rows else None

    def _gate_rate(rows: List[Dict[str, Any]], gate: str) -> Optional[float]:
        # Gate answers are "true"/"false" strings — truthiness would count
        # "false" as true, so compare explicitly.
        if not rows:
            return None
        return round(sum(1 for r in rows if r[gate] == "true") / len(rows), 4)

    successes = [r for r in steps_report if r["llm_success"]]
    failures = [r for r in steps_report if not r["llm_success"]]

    return {
        "task_id": task.task_id,
        "decide_steps": len(steps_report),
        "llm_turns_recorded": len(provider.calls),
        "agreement_rate": _rate(steps_report),        "op_agreement_rate": _rate(steps_report, "op_agree"),
        "target_agreement_rate": _rate([r for r in steps_report if r["target_agree"] is not None]),
        "agreement_given_llm_success": _rate(successes),
        "agreement_given_llm_failure": _rate(failures),
        "llm_failure_steps": len(failures),
        # Goal/stuck gates: how often the head's stuck flag fires, split by
        # what the LLM step actually did (calibration signal for later tiers).
        "stuck_true_rate": _gate_rate(steps_report, "stuck"),
        "stuck_true_rate_given_llm_success": _gate_rate(successes, "stuck"),
        "stuck_true_rate_given_llm_failure": _gate_rate(failures, "stuck"),
        "goal_satisfied_true_rate": _gate_rate(steps_report, "goal_satisfied"),
        "mean_head_latency_ms": round(
            sum(r["head_latency_ms"] for r in steps_report) / len(steps_report), 3
        ) if steps_report else None,
        "mean_llm_latency_ms": round(
            sum(r["llm_latency_ms"] for r in steps_report) / len(steps_report), 3
        ) if steps_report else None,
        # Canonical-vocabulary misses recorded by heads that track them
        # (KimiCliHead); absent (key missing) for heads without the counter.
        **({"vocab_misses": [dict(m) for m in shadow_head_vocab_misses]}
           if (shadow_head_vocab_misses := getattr(shadow_head, "vocab_misses", None)) is not None else {}),
        "executed_actions": adapter.executed,
        "steps": steps_report,
    }


def run_eval(
    tasks: Optional[Sequence[SyntheticTask]] = None,
    steps_per_task: int = DEFAULT_STEPS_PER_TASK,
    head: Optional[DecisionHead] = None,
    head_label: str = "mock",
    step_budget_ms: int = 15_000,
    progress: bool = False,
) -> Dict[str, Any]:
    """Run the full shadow eval over the synthetic task set.

    ``head`` overrides the scripted MockHead (e.g. MlxDirectLogitHead for
    real-weights agreement numbers, KimiCliHead for the cloud-iteration tier);
    ``head_label`` identifies the head in the report. ``step_budget_ms``
    scales the per-task wall-clock budget for slow heads (kimi CLI
    subprocesses); ``progress`` prints one line per decide step.
    """
    task_list = list(tasks) if tasks is not None else default_tasks(steps_per_task)
    reports = [
        run_task_sync(t, head=head, step_budget_ms=step_budget_ms, progress=progress)
        for t in task_list
    ]

    all_steps = [s for r in reports for s in r["steps"]]
    successes = [s for s in all_steps if s["llm_success"]]
    failures = [s for s in all_steps if not s["llm_success"]]

    def _rate(rows: List[Dict[str, Any]]) -> Optional[float]:
        return round(sum(1 for r in rows if r["agreement"]) / len(rows), 4) if rows else None

    def _gate_rate(rows: List[Dict[str, Any]], gate: str) -> Optional[float]:
        if not rows:
            return None
        return round(sum(1 for r in rows if r[gate] == "true") / len(rows), 4)

    aggregate = {
        "tasks": len(reports),
        "total_decide_steps": len(all_steps),
        "min_decide_steps_per_task": min((r["decide_steps"] for r in reports), default=0),
        "agreement_rate": _rate(all_steps),
        "agreement_given_llm_success": _rate(successes),
        "agreement_given_llm_failure": _rate(failures),
        "stuck_true_rate": _gate_rate(all_steps, "stuck"),
        "stuck_true_rate_given_llm_success": _gate_rate(successes, "stuck"),
        "stuck_true_rate_given_llm_failure": _gate_rate(failures, "stuck"),
        "goal_satisfied_true_rate": _gate_rate(all_steps, "goal_satisfied"),
        "mean_head_latency_ms": round(
            sum(s["head_latency_ms"] for s in all_steps) / len(all_steps), 3
        ) if all_steps else None,
        "mean_llm_latency_ms": round(
            sum(s["llm_latency_ms"] for s in all_steps) / len(all_steps), 3
        ) if all_steps else None,
        # Canonical-vocab misses (KimiCliHead tracks these; mock/mlx don't).
        **({"vocab_miss_count": sum(len(t.get("vocab_misses", [])) for t in reports)}
           if any("vocab_misses" in t for t in reports) else {}),
        "note": (
            "KimiCliHead numbers — the kimi CLI subprocess head answers the "
            "same closed-set questions as the scripted LLM transcript under a "
            "strict JSON contract; agreement measures how often its chosen "
            "answers match the recorded LLM decisions. Per-option "
            "probabilities are the chosen option at kimi's stated confidence "
            "with the remainder split uniformly (confidence-scalar, not a "
            "distribution — an mlx/local-tier property)."
            if head_label == "kimi" else
            "MlxDirectLogitHead real-weights numbers — the local mlx-lm head "
            "answers the same closed-set questions as the scripted LLM "
            "transcript; agreement measures how often its first-token choices "
            "match the recorded LLM decisions."
            if head is not None else
            "MockHead plumbing numbers — scripted head agrees with the scripted "
            "LLM transcript except deterministic disagreements; real agreement "
            "needs the mlx-lm head weights."
        ),
    }

    return {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "steps_per_task": steps_per_task,
        "head": head_label,
        "aggregate": aggregate,
        "tasks": reports,
    }


def write_reports(
    report: Dict[str, Any],
    out_dir: Path,
    stem: str = "shadow-eval-report",
) -> Tuple[Path, Path]:
    """Write the eval report as JSON + markdown; returns both paths."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    json_path = out_dir / f"{stem}.json"
    json_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    md_path = out_dir / f"{stem}.md"
    md_path.write_text(render_markdown(report), encoding="utf-8")
    return json_path, md_path


def render_markdown(report: Dict[str, Any]) -> str:
    agg = report["aggregate"]
    if report.get("head") == "mock":
        head_lines = [
            "> **Head:** MockHead (scripted stand-in for the mlx-lm direct-logit head).",
            "> Agreement numbers validate the eval plumbing offline; they are NOT",
            "> measurements of real head quality (weights are not downloaded in-session).",
        ]
    elif report.get("head") == "kimi":
        head_lines = [
            f"> **Head:** KimiCliHead (kimi CLI subprocess, cloud-iteration tier; "
            f"questioning={report.get('questioning', 'batched')}).",
            "> kimi answers a strict JSON contract per pass; per-option probabilities",
            "> are the chosen option at its stated confidence with the remainder split",
            "> uniformly (confidence-scalar, not a distribution — an mlx/local-tier",
            "> property). Non-canonical answers are folded to the whitelist vocabulary",
            "> and counted as vocab misses.",
        ]
    else:
        head_lines = [
            f"> **Head:** {report['head']} (real weights, local mlx-lm inference).",
            "> The LLM side is still the recorded transcript; agreement measures",
            "> head-vs-LLM first-token choice match on identical observations.",
        ]
    lines = [
        "# Shadow Head Eval Report",
        "",
        f"Generated: {report['generated_at']}",
        "",
        *head_lines,
        "",
        "## Aggregate",
        "",
        "| Metric | Value |",
        "|---|---|",
        f"| Tasks | {agg['tasks']} |",
        f"| Total decide steps | {agg['total_decide_steps']} |",
        f"| Min decide steps per task | {agg['min_decide_steps_per_task']} |",
        f"| Agreement rate | {_fmt(agg['agreement_rate'])} |",
        f"| Agreement given LLM success | {_fmt(agg['agreement_given_llm_success'])} |",
        f"| Agreement given LLM failure | {_fmt(agg['agreement_given_llm_failure'])} |",
        f"| Stuck=true rate (all steps) | {_fmt(agg['stuck_true_rate'])} |",
        f"| Stuck=true given LLM success | {_fmt(agg['stuck_true_rate_given_llm_success'])} |",
        f"| Stuck=true given LLM failure | {_fmt(agg['stuck_true_rate_given_llm_failure'])} |",
        f"| Goal-satisfied=true rate | {_fmt(agg['goal_satisfied_true_rate'])} |",
        f"| Mean head latency (ms) | {_fmt(agg['mean_head_latency_ms'])} |",
        f"| Mean LLM latency (ms) | {_fmt(agg['mean_llm_latency_ms'])} |",
    ]
    if "vocab_miss_count" in agg:
        lines.append(f"| Vocab misses | {agg['vocab_miss_count']} |")
    lines += [
        "",
        "## Per task",
        "",
        "| Task | Steps | Agreement | Agree (LLM ok) | Agree (LLM fail) | Stuck (fail) | Head ms | LLM ms |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for task in report["tasks"]:
        lines.append(
            f"| {task['task_id']} | {task['decide_steps']} | {_fmt(task['agreement_rate'])} "
            f"| {_fmt(task['agreement_given_llm_success'])} "
            f"| {_fmt(task['agreement_given_llm_failure'])} "
            f"| {_fmt(task['stuck_true_rate_given_llm_failure'])} "
            f"| {_fmt(task['mean_head_latency_ms'])} | {_fmt(task['mean_llm_latency_ms'])} |"
        )
    lines += ["", "## Method", "", agg["note"], ""]
    return "\n".join(lines)


def _fmt(value: Any) -> str:
    return "n/a" if value is None else str(value)
