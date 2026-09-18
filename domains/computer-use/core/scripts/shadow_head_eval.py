"""
Shadow head eval — offline harness entrypoint.

Runs the shadow decision head beside scripted (recorded) LLM decide steps
over three synthetic task observations and writes the eval report:

    python domains/computer-use/core/scripts/shadow_head_eval.py [--steps N]
        [--head {mock,mlx,kimi}] [--questioning {batched,sequential}]
        [--out-dir DIR] [--quiet]

The LLM provider replays a recorded transcript and the AX observation is
scripted, so the run is deterministic except for the head itself:
``--head mock`` (default) uses a deterministic MockHead with a scripted
opinion transcript (fully offline, no downloads); ``--head mlx`` uses the
real MlxDirectLogitHead (mlx-lm, Qwen3-4B-Instruct-2507-4bit) — the first
run downloads ~2.5GB of weights from a public ungated HF repo, then runs
fully local; ``--head kimi`` drives the KimiCliHead (cloud-iteration tier):
one ``kimi -p`` subprocess per decide step, auth handled inside the CLI.
``--questioning`` applies to the kimi head only: ``batched`` (default) asks
all questions in one subprocess call per step; ``sequential`` asks the
operation + gates first, then the chosen operation's target menu (2 calls
per step, smaller menus per pass). See core/shadow_eval.py for what the
numbers do and do not mean.
"""

from __future__ import annotations

import argparse
import importlib.util
import logging
import sys
from pathlib import Path

DOMAIN_CORE_ROOT = Path(__file__).resolve().parents[1]
for _extra in (str(DOMAIN_CORE_ROOT),):
    if _extra not in sys.path:
        sys.path.insert(0, _extra)

DEFAULT_OUT_DIR = DOMAIN_CORE_ROOT / "evaluation" / "shadow-eval"

# Per-decide-step wall-clock budget passed down to the planning loop, by head.
# kimi CLI subprocesses run ~25s per call (batched: 1 call/step; sequential:
# 2 calls/step), so the default 15s/step budget would kill the run mid-task.
_STEP_BUDGET_MS = {"mock": 15_000, "mlx": 15_000, "kimi": 60_000}


def build_head(name: str, questioning: str = "batched") -> "tuple[object, str]":
    """Construct the decision head for ``--head``; (head, report-stem-suffix)."""
    if name == "mock":
        return None, ""

    if name == "kimi":
        from core.decision_head import KimiCliHead

        head = KimiCliHead(questioning=questioning)
        print(
            f"Using KimiCliHead ({head.binary}, questioning={questioning}); "
            "one `kimi -p` subprocess per decide step."
        )
        suffix = "-kimi" + ("-sequential" if questioning == "sequential" else "")
        return head, suffix

    # mlx path — fail fast with an actionable error before the harness runs.
    if importlib.util.find_spec("mlx_lm") is None:
        raise SystemExit(
            "--head mlx needs the optional 'shadow-head' extra, which is not "
            "installed in this environment. Install it with:\n"
            "    uv pip install -e '.[shadow-head]'\n"
            "(mlx is Apple-silicon only; no hosted fallback exists by design.)"
        )
    from core.decision_head import MlxDirectLogitHead

    head = MlxDirectLogitHead()
    print(
        "Using MlxDirectLogitHead "
        f"({head.model_repo}); first run downloads ~2.5GB of weights."
    )
    return head, "-mlx"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--steps",
        type=int,
        default=22,
        help="decide steps per task (default 22, >= 20 required by the acceptance criteria)",
    )
    parser.add_argument(
        "--head",
        choices=("mock", "mlx", "kimi"),
        default="mock",
        help="decision head to score (default mock; mlx = real local mlx-lm "
             "weights; kimi = KimiCliHead subprocess cloud tier)",
    )
    parser.add_argument(
        "--questioning",
        choices=("batched", "sequential"),
        default="batched",
        help="questioning mode for the kimi head (default batched; sequential "
             "= operation+gates first, then the chosen operation's target menu, "
             "2 subprocess calls per step)",
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

    head, stem_suffix = build_head(args.head, questioning=args.questioning)
    if args.questioning != "batched" and args.head != "kimi":
        print(f"note: --questioning {args.questioning} applies to the kimi head only; "
              f"--head {args.head} ignores it.")

    from core.shadow_eval import default_tasks, run_eval, write_reports

    step_budget = _STEP_BUDGET_MS[args.head]
    if args.head == "kimi" and args.questioning == "sequential":
        step_budget *= 2  # two subprocess calls per decide step

    report = run_eval(
        tasks=default_tasks(args.steps),
        steps_per_task=args.steps,
        head=head,
        head_label=args.head,
        step_budget_ms=step_budget,
        progress=not args.quiet,
    )
    report["questioning"] = args.questioning
    json_path, md_path = write_reports(report, args.out_dir, stem=f"shadow-eval-report{stem_suffix}")

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
    if "vocab_miss_count" in agg:
        print(f"  vocab misses:                  {agg['vocab_miss_count']}")
    print(f"\nNote: {agg['note']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
