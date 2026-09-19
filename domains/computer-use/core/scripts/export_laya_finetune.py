"""
Export live shadow-head traces (core/trace_recorder.py JSONL) into Laya
fine-tune cases, matching the LocalLLaMA/typed-decisions row schema that the
official Laya Kaggle fine-tune notebook
(notebooks/laya_finetune_typed_decisions_2xT4_kaggle.ipynb on
github.com/NandhaKishorM/laya) consumes:

    {"id", "workflow", "state", "questions", "gold"}   — state/questions/gold
    are JSON STRINGS; each gold entry is {"label", "probabilities"} with the
    probability mass over the question's criteria keys (one-hot for our
    hard transcript labels; the notebook's build_training_item normalizes).

LABEL SOURCE (the property that makes this cheap): gold labels come from the
recorded-LLM transcript (the recorder's ``gold`` field — the EXECUTED LLM
step), NEVER from the head's own choices. A mock-head harness run therefore
produces perfectly labeled fine-tune data offline at zero cloud cost; the
head column in the trace is ignored here entirely.

TEMPORAL REALIGNMENT (default: on, ``--no-realign`` to disable): the
recorder labels each record with the PREVIOUSLY EXECUTED step — the action
whose effect is visible in that state's [SINCE LAST STEP] block. A policy
head deciding from state S must instead predict the action taken FROM S
(the eval's agreement definition compares head@step-N against LLM turn N).
Within one run those are the same transcript shifted by one record, so the
exporter pairs record N's state/questions with record N+1's gold. The final
record of every run is dropped (no next gold exists); records whose aligned
gold references an operation or row index not present in THEIR OWN question
menus are dropped too (row indices can shift when the page changed between
steps — counted and reported, see docs/JEV_LAYA_NOTES.md).

Gates (goal_satisfied / stuck) carry no gold in the recorder schema and are
exported as questions WITHOUT gold entries (the notebook's
build_training_item only trains questions present in gold, so they are
skipped — gate supervision is a known v1 gap).

Splits pass through from the recorder (split=heldout labels the three
held-out synthetic eval tasks); use --split to emit only one split.

Usage:
    python scripts/export_laya_finetune.py traces.jsonl -o laya-cases.jsonl
    python scripts/export_laya_finetune.py traces.jsonl --split train \
        -o train.jsonl --report
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

DOMAIN_CORE_ROOT = Path(__file__).resolve().parents[1]
if str(DOMAIN_CORE_ROOT) not in sys.path:
    sys.path.insert(0, str(DOMAIN_CORE_ROOT))

from core.laya_head import laya_question_def  # noqa: E402

# Question names whose options are the canonical operation vocabulary and
# therefore share the exporter/head question construction 1:1.
_GATES = ("goal_satisfied", "stuck")


def load_records(path: Path) -> List[Dict[str, Any]]:
    records = []
    with Path(path).open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError as exc:
                raise SystemExit(
                    f"{path}:{line_number}: invalid JSON ({exc})"
                )
    return records


def _run_key(record: Dict[str, Any]) -> Tuple[str, str]:
    return (str(record.get("task_id") or ""), str(record.get("run_id") or ""))


def _menus(record: Dict[str, Any]) -> Dict[str, List[str]]:
    return {
        str(q["name"]): [str(o) for o in q.get("options", [])]
        for q in (record.get("questions") or [])
    }


def _one_hot(option: str, options: List[str]) -> Dict[str, float]:
    if option not in options:
        return {}
    return {o: (1.0 if o == option else 0.0) for o in options}


def export_case(
    record: Dict[str, Any],
    aligned_gold: Dict[str, str],
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """Build one typed-decisions-style case from a trace record plus its
    realigned gold. Returns (case, None) or (None, drop_reason)."""
    menus = _menus(record)
    operation_options = menus.get("operation", [])
    op = aligned_gold.get("operation")
    if not op:
        return None, "aligned gold has no operation"
    if op not in operation_options:
        return None, f"gold operation {op!r} not in this state's menu"

    # Questions: exactly what the head asks at inference time.
    questions: Dict[str, Any] = {}
    for name, options in menus.items():
        if len(options) >= 2:
            questions[name] = laya_question_def(name, options)

    # Gold: one-hot choice entries over the realigned transcript labels.
    gold: Dict[str, Any] = {}
    op_entry_target = aligned_gold.get(f"{op}_target")
    if op_entry_target is not None:
        target_options = menus.get(f"{op}_target", [])
        target_dist = _one_hot(str(op_entry_target), target_options)
        if not target_dist:
            return None, (
                f"gold target {op_entry_target!r} not in this state's "
                f"{op}_target menu"
            )
        gold[f"{op}_target"] = {
            "label": str(op_entry_target),
            "probabilities": target_dist,
        }
    gold["operation"] = {
        "label": op,
        "probabilities": _one_hot(op, operation_options),
    }

    return {
        "id": str(record.get("trace_id") or ""),
        "workflow": str(record.get("task_id") or ""),
        "split": str(record.get("split") or "train"),
        "state": json.dumps(str(record.get("state_text") or "")),
        "questions": json.dumps(questions),
        "gold": json.dumps(gold),
    }, None


def export_records(
    records: List[Dict[str, Any]],
    realign: bool = True,
) -> Tuple[List[Dict[str, Any]], Counter]:
    """Convert trace records to cases. With realign, golds are shifted one
    step forward within each (task_id, run_id) group (see module docstring).
    Returns (cases, stats Counter)."""
    stats: Counter = Counter()
    cases: List[Dict[str, Any]] = []

    groups: Dict[Tuple[str, str], List[Dict[str, Any]]] = {}
    for record in records:
        groups.setdefault(_run_key(record), []).append(record)
    for group in groups.values():
        group.sort(key=lambda r: int(r.get("step") or 0))

    for group in groups.values():
        stats["runs"] += 1
        if realign:
            aligned = [
                (record, group[i + 1].get("gold") or {})
                for i, record in enumerate(group[:-1])
            ]
            stats["tail_records_dropped"] += 1
        else:
            aligned = [(record, record.get("gold") or {}) for record in group]
        for record, gold in aligned:
            stats["records_seen"] += 1
            if not gold:
                stats["dropped_empty_gold"] += 1
                continue
            case, reason = export_case(record, gold)
            if case is None:
                stats[f"dropped:{reason.split(' not ')[0]}"] += 1
                stats["dropped_total"] += 1
                continue
            stats["cases"] += 1
            cases.append(case)
    return cases, stats


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("traces", type=Path, help="trace JSONL (recorder schema)")
    parser.add_argument("-o", "--out", type=Path, required=True,
                        help="output JSONL of typed-decisions-style cases")
    parser.add_argument("--split", choices=("train", "heldout"),
                        default=None, help="emit only one split")
    parser.add_argument("--no-realign", action="store_true",
                        help="use each record's own gold instead of shifting "
                             "gold one step forward within each run")
    parser.add_argument("--report", action="store_true",
                        help="print conversion stats and one sample case")
    args = parser.parse_args(argv)

    records = load_records(args.traces)
    cases, stats = export_records(records, realign=not args.no_realign)
    if args.split:
        cases = [c for c in cases if c["split"] == args.split]

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8") as handle:
        for case in cases:
            handle.write(json.dumps(case) + "\n")

    print(f"traces:  {args.traces}")
    print(f"cases:   {args.out} ({len(cases)} cases"
          + (f", split={args.split}" if args.split else "") + ")")
    if args.report:
        for key in sorted(stats):
            print(f"  {key}: {stats[key]}")
        if cases:
            print("\nsample case:")
            print(json.dumps(cases[0], indent=2)[:2000])
    return 0


if __name__ == "__main__":
    sys.exit(main())
