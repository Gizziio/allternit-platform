"""
Shadow head eval — offline harness entrypoint.

Runs the shadow decision head beside scripted (recorded) LLM decide steps
over three synthetic task observations and writes the eval report:

    python domains/computer-use/core/scripts/shadow_head_eval.py [--steps N]
        [--out-dir DIR] [--quiet]

Fully offline and deterministic: the LLM provider replays a recorded
transcript, the AX observation is scripted, and the head is a deterministic
MockHead (the mlx-lm head needs weights this script never downloads).
See core/shadow_eval.py for what the numbers do and do not mean.
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

DOMAIN_CORE_ROOT = Path(__file__).resolve().parents[1]
for _extra in (str(DOMAIN_CORE_ROOT),):
    if _extra not in sys.path:
        sys.path.insert(0, _extra)

DEFAULT_OUT_DIR = DOMAIN_CORE_ROOT / "evaluation" / "shadow-eval"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--steps",
        type=int,
        default=22,
        help="decide steps per task (default 22, >= 20 required by the acceptance criteria)",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=DEFAULT_OUT_DIR,
        help=f"report output directory (default {DEFAULT_OUT_DIR})",
    )
    parser.add_argument("--quiet", action="store_true", help="suppress progress output")
    args = parser.parse_args(argv)

    if args.steps < 20:
        parser.error("acceptance criteria require >= 20 decide steps per task")

    logging.basicConfig(
        level=logging.WARNING if args.quiet else logging.INFO,
        format="%(levelname)s %(name)s: %(message)s",
    )

    from core.shadow_eval import default_tasks, run_eval, write_reports

    report = run_eval(tasks=default_tasks(args.steps), steps_per_task=args.steps)
    json_path, md_path = write_reports(report, args.out_dir)

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
    print(f"\nNote: {agg['note']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
