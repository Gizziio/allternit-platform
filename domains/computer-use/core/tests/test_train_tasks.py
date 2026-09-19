"""Contract tests for the TRAIN-split synthetic task suite (core/train_tasks.py).

The three canonical held-out tasks are verification data only; these templates
mint labeled TRAIN decisions for the Laya fine-tune (traces labeled
split=train by core/trace_recorder.py because every task_id is outside
HELD_OUT_TASK_IDS). Pinned here:

- per-seed determinism (two builds equal; different seeds differ);
- turns/trees alignment (every turn's target resolves via
  ElementTable.match_target on every step tree AND supports the turn's
  mapped whitelist operation);
- op coverage across the suite (every family the transcript mapping can
  emit, with click plurality but substantial fill/select/scroll);
- split labeling end-to-end (a recorded trace for a train task is
  split="train");
- no task_id collision with HELD_OUT_TASK_IDS;
- the held-out default_tasks output is byte-identical to the canonical
  definitions (benchmark stability — pinned literally).
"""

from __future__ import annotations

import json

from core import shadow_eval
from core.element_table import build_element_table
from core.kimi_fewshot import HELD_OUT_TASK_IDS
from core.shadow_eval import _LLM_OP_MAP, _step_trees
from core.train_tasks import TRAIN_TASK_IDS, train_tasks

# Every whitelist op family reachable through the transcript mapping
# (core/shadow_eval.py _LLM_OP_MAP: fill/type→fill, select→selectOptionFromDropdown,
# scroll→scrollTo, key→press, double_click→doubleClick).
_MAPPED_OPS = frozenset(_LLM_OP_MAP.values())


# ---------------------------------------------------------------------------
# Serialization helpers (per-seed stability comparisons)
# ---------------------------------------------------------------------------

def _node_sig(node):
    return (
        node.role,
        node.name,
        node.value,
        node.is_interactive,
        tuple(_node_sig(child) for child in node.children or []),
    )


def _task_sig(task):
    return {
        "task_id": task.task_id,
        "task": task.task,
        "fail_targets": list(task.fail_targets),
        "turns": [
            (t.action_type, t.target, t.text, t.latency_ms) for t in task.turns
        ],
        "tree": _node_sig(task.tree),
    }


# ---------------------------------------------------------------------------
# Determinism + seed parameterization
# ---------------------------------------------------------------------------

def test_per_seed_stability():
    for seed in (42, 7, 1234):
        first = [_task_sig(t) for t in train_tasks(seed, 22)]
        second = [_task_sig(t) for t in train_tasks(seed, 22)]
        assert first == second


def test_different_seeds_produce_different_suites():
    sig_42 = [_task_sig(t) for t in train_tasks(42, 22)]
    sig_7 = [_task_sig(t) for t in train_tasks(7, 22)]
    assert sig_42 != sig_7
    differing = sum(1 for a, b in zip(sig_42, sig_7) if a != b)
    assert differing >= len(sig_42) // 2, (
        f"only {differing}/{len(sig_42)} templates vary with the seed"
    )


# ---------------------------------------------------------------------------
# Contract: turns align with step trees and the whitelist vocabulary
# ---------------------------------------------------------------------------

def test_turn_targets_resolve_and_support_mapped_op():
    for seed in (42, 7):
        for task in train_tasks(seed, 22):
            for tree in _step_trees(task):
                table = build_element_table(tree)
                distinct_ops = set()
                for turn in task.turns:
                    op = _LLM_OP_MAP[turn.action_type]
                    distinct_ops.add(op)
                    matched = table.match_target(turn.target)
                    assert matched is not None, (
                        f"{task.task_id}: turn target {turn.target!r} does not "
                        f"resolve on a step tree"
                    )
                    row = table.row(matched)
                    assert op in row.operations, (
                        f"{task.task_id}: {op} not supported by row "
                        f"{row.role}:{row.name} (turn target {turn.target!r})"
                    )
                assert len(distinct_ops) >= 3, (
                    f"{task.task_id}: only {sorted(distinct_ops)} — each "
                    f"template must exercise >= 3 distinct whitelist ops"
                )


def test_op_coverage_across_suite():
    counts = {}
    for task in train_tasks(42, 22):
        for turn in task.turns:
            op = _LLM_OP_MAP[turn.action_type]
            counts[op] = counts.get(op, 0) + 1

    assert set(counts) == set(_MAPPED_OPS), (
        f"missing mapped op families: {set(_MAPPED_OPS) - set(counts)}"
    )
    # Rough mirror of the real op distribution: click is the plurality but
    # fill/select/scroll are substantial (not op-skewed data).
    total = sum(counts.values())
    assert counts["click"] > total * 0.3
    assert counts["fill"] > total * 0.2
    assert counts["selectOptionFromDropdown"] > 0
    assert counts["scrollTo"] > 0
    assert counts["press"] > 0
    assert counts["doubleClick"] > 0


# ---------------------------------------------------------------------------
# Split discipline
# ---------------------------------------------------------------------------

def test_task_ids_outside_held_out_set():
    assert set(TRAIN_TASK_IDS).isdisjoint(HELD_OUT_TASK_IDS)
    tasks = train_tasks(42, 22)
    assert len({t.task_id for t in tasks}) == len(tasks), "duplicate task ids"


def test_traces_recorded_as_train_split(tmp_path):
    """End-to-end through the harness: a train task's trace records carry
    split="train" (trace_recorder labels only the 3 canonical ids heldout)."""
    task = train_tasks(42, steps_per_task=8)[0]
    trace_path = tmp_path / "train-trace.jsonl"
    shadow_eval.run_task_sync(task, trace_path=trace_path)

    records = [
        json.loads(line)
        for line in trace_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    assert records, "no trace records written"
    assert {r["task_id"] for r in records} == {task.task_id}
    assert all(r["split"] == "train" for r in records)
    # Labels come from the recorded transcript: every record past step 1
    # carries a gold operation from the mapped vocabulary.
    for record in records:
        gold = record.get("gold") or {}
        if not gold:
            continue
        assert gold["operation"] in _MAPPED_OPS


# ---------------------------------------------------------------------------
# Held-out benchmark stability: default_tasks unchanged
# ---------------------------------------------------------------------------

def test_default_tasks_unchanged():
    """Pin the canonical held-out tasks literally — the train lane must never
    drift them (benchmark stability)."""
    tasks = {t.task_id: t for t in shadow_eval.default_tasks(22)}
    assert set(tasks) == {"search-flow", "form-fill", "settings-toggle"}

    expected_turns = {
        "search-flow": [
            ("fill", "Search query", "quarterly report"),
            ("click", "Search", None),
            ("click", "First result", None),
        ],
        "form-fill": [
            ("fill", "Email", "operator@eval.local"),
            ("fill", "Password", "hunter2"),
            ("click", "Submit", None),
        ],
        "settings-toggle": [
            ("click", "Theme", None),
            ("click", "Notifications", None),
            ("click", "Save", None),
        ],
    }
    expected_fail = {
        "search-flow": ["First result"],
        "form-fill": ["Submit"],
        "settings-toggle": ["Notifications"],
    }
    for task_id, task in tasks.items():
        assert len(task.turns) == 22
        assert task.fail_targets == expected_fail[task_id]
        for i, turn in enumerate(task.turns):
            action_type, target, text = expected_turns[task_id][i % 3]
            assert turn.action_type == action_type
            assert turn.target == target
            assert turn.text == text
