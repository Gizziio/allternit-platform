"""
Single-head shadow eval runner (programmatic heads, standalone).

``scripts/shadow_head_eval.py`` is the shared CLI for the built-in heads
(mock / mlx / kimi / semif) and is owned by another lane. This runner exists
so any DecisionHead-conforming class (e.g. core.laya_head.LayaHead) can be
evaluated through the identical harness without touching that CLI: it
imports the class by module path, constructs it (optionally with kwargs),
and drives ``core.shadow_eval.run_eval`` over ``default_tasks`` exactly like
the shared entrypoint does, then writes JSON + markdown reports via
``write_reports`` under a caller-chosen stem.

    python scripts/run_head_eval.py --module core.laya_head --class LayaHead \
        [--kwargs model=convaiinnovations/laya,max_direct_options=16] \
        [--steps 22] [--out-dir evaluation/shadow-eval] \
        [--stem shadow-eval-report-laya] [--trace-out PATH.jsonl] \
        [--step-budget-ms 15000] [--quiet]

Head construction mirrors the shared CLI's contract: construction-time
failures (missing optional dependencies, absent binaries) raise immediately
with the head's own actionable error — the harness never starts.
"""

from __future__ import annotations

import argparse
import importlib
import logging
import sys
from pathlib import Path
from typing import Any, Dict, Optional

DOMAIN_CORE_ROOT = Path(__file__).resolve().parents[1]
if str(DOMAIN_CORE_ROOT) not in sys.path:
    sys.path.insert(0, str(DOMAIN_CORE_ROOT))

DEFAULT_OUT_DIR = DOMAIN_CORE_ROOT / "evaluation" / "shadow-eval"


def _parse_kwargs(raw: str) -> Dict[str, Any]:
    """``k=v,k=v`` -> dict, with JSON-ish value coercion (ints, floats,
    booleans, null, quoted strings fall back to plain strings)."""
    kwargs: Dict[str, Any] = {}
    for pair in raw.split(","):
        pair = pair.strip()
        if not pair:
            continue
        if "=" not in pair:
            raise SystemExit(f"--kwargs entry lacks '=': {pair!r}")
        key, _, value = pair.partition("=")
        key = key.strip()
        value = value.strip()
        lowered = value.lower()
        if lowered in ("true", "false"):
            kwargs[key] = lowered == "true"
        elif lowered in ("none", "null"):
            kwargs[key] = None
        else:
            try:
                kwargs[key] = int(value)
            except ValueError:
                try:
                    kwargs[key] = float(value)
                except ValueError:
                    kwargs[key] = value.strip("'\"")
    return kwargs


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--module", required=True,
                        help="dotted module path, e.g. core.laya_head")
    parser.add_argument("--class", dest="class_name", required=True,
                        help="head class name inside the module, e.g. LayaHead")
    parser.add_argument("--kwargs", default="",
                        help="comma-separated constructor kwargs (k=v,...); "
                             "values coerce to int/float/bool/null")
    parser.add_argument("--steps", type=int, default=22,
                        help="decide steps per task (default 22, >= 20 required)")
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR,
                        help=f"report output directory (default {DEFAULT_OUT_DIR})")
    parser.add_argument("--stem", default=None,
                        help="report filename stem (default: the class name, "
                             "e.g. shadow-eval-report-LayaHead)")
    parser.add_argument("--trace-out", type=Path, default=None,
                        help="append live trace JSONL records here "
                             "(core/trace_recorder.py; held-out task ids are "
                             "labeled split=heldout by the recorder)")
    parser.add_argument("--step-budget-ms", type=int, default=15_000,
                        help="per-decide-step wall-clock budget (default "
                             "15000 — raise for slow heads)")
    parser.add_argument("--quiet", action="store_true",
                        help="suppress progress output")
    args = parser.parse_args(argv)

    if args.steps < 20:
        parser.error("acceptance criteria require >= 20 decide steps per task")

    logging.basicConfig(
        level=logging.WARNING if args.quiet else logging.INFO,
        format="%(levelname)s %(name)s: %(message)s",
    )

    module = importlib.import_module(args.module)
    head_class = getattr(module, args.class_name)
    kwargs = _parse_kwargs(args.kwargs)
    head = head_class(**kwargs)
    print(
        f"Using {args.module}.{args.class_name}"
        + (f" with kwargs {kwargs}" if kwargs else "")
        + "."
    )

    from core.shadow_eval import default_tasks, run_eval, write_reports

    report = run_eval(
        tasks=default_tasks(args.steps),
        steps_per_task=args.steps,
        head=head,
        head_label=args.class_name,
        step_budget_ms=args.step_budget_ms,
        progress=not args.quiet,
        trace_path=str(args.trace_out) if args.trace_out else None,
    )
    stem = args.stem or f"shadow-eval-report-{args.class_name}"
    json_path, md_path = write_reports(report, args.out_dir, stem=stem)

    agg = report["aggregate"]
    print(f"\nShadow eval complete — reports written:")
    print(f"  JSON: {json_path}")
    print(f"  MD:   {md_path}")
    print(f"\nAggregate over {agg['tasks']} tasks / {agg['total_decide_steps']} decide steps:")
    print(f"  agreement rate:                {agg['agreement_rate']}")
    print(f"  agreement given LLM success:   {agg['agreement_given_llm_success']}")
    print(f"  agreement given LLM failure:   {agg['agreement_given_llm_failure']}")
    print(f"  stuck=true given LLM success:  {agg['stuck_true_rate_given_llm_success']}")
    print(f"  stuck=true given LLM failure:  {agg['stuck_true_rate_given_llm_failure']}")
    print(f"  goal-satisfied=true rate:      {agg['goal_satisfied_true_rate']}")
    print(f"  mean head latency:             {agg['mean_head_latency_ms']} ms")
    print(f"  mean LLM latency:              {agg['mean_llm_latency_ms']} ms")
    if args.trace_out:
        print(f"  live traces appended:          {report['trace_records']} -> {args.trace_out}")
    print(f"\nNote: {agg['note']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
