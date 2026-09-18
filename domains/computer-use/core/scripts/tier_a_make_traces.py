"""
Tier A trace generation — dump labelled (state_text, questions, gold) traces
from the shadow eval harness's scripted tasks.

The recorded-LLM transcript is the reference policy (the distillation
target): every decide step is labelled with the recorded operation and the
recorded target resolved against the step's element table. The three
canonical eval tasks are held out; all training data comes from parameterized
task variants with dynamic per-step observations (see core/tier_a_traces.py).

    python scripts/tier_a_make_traces.py [--out PATH] [--seed N]
        [--variants N] [--val N] [--heldout-steps N]

Default output: evaluation/tier-a/traces.jsonl (committed — the split is
part of the experiment record).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

DOMAIN_CORE_ROOT = Path(__file__).resolve().parents[1]
for _extra in (str(DOMAIN_CORE_ROOT),):
    if _extra not in sys.path:
        sys.path.insert(0, _extra)

DEFAULT_OUT = DOMAIN_CORE_ROOT / "evaluation" / "tier-a" / "traces.jsonl"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT,
                        help=f"output JSONL path (default {DEFAULT_OUT})")
    parser.add_argument("--seed", type=int, default=42, help="variant generation seed")
    parser.add_argument("--variants", type=int, default=22,
                        help="total task variants (train + val)")
    parser.add_argument("--val", type=int, default=4, help="variants reserved for val")
    parser.add_argument("--heldout-steps", type=int, default=22,
                        help="decide steps per held-out canonical task")
    args = parser.parse_args(argv)

    from core.tier_a_traces import build_traces, split_counts, write_traces

    traces = build_traces(
        seed=args.seed,
        n_variants=args.variants,
        n_val=args.val,
        heldout_steps=args.heldout_steps,
    )
    write_traces(traces, args.out)
    counts = split_counts(traces)
    print(f"wrote {len(traces)} traces to {args.out}")
    for split, count in counts.items():
        print(f"  {split}: {count} steps")
    heldout = [t for t in traces if t["split"] == "heldout"]
    print(f"held-out tasks: {sorted({t['task_id'] for t in heldout})}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
