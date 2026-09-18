"""
Tier A training — fine-tune the ModernBERT cross-scorer on labelled traces.

    python scripts/tier_a_train.py [--traces PATH] [--out-dir DIR] [--epochs N]
        [--lr X] [--batch-groups N] [--brier-weight X] [--seed N]

Defaults read traces from evaluation/tier-a/traces.jsonl and write the
trained bundle (model + tokenizer + scorer + temperature + metrics.json) to
~/.allternit/shadow-head/tier-a (override with SHADOW_HEAD_TIER_A_DIR).
The bundle is what TierAClassifierHead loads at inference; training is the
only step that touches the network (one-time base-model download).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

DOMAIN_CORE_ROOT = Path(__file__).resolve().parents[1]
for _extra in (str(DOMAIN_CORE_ROOT),):
    if _extra not in sys.path:
        sys.path.insert(0, _extra)

DEFAULT_TRACES = DOMAIN_CORE_ROOT / "evaluation" / "tier-a" / "traces.jsonl"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--traces", type=Path, default=DEFAULT_TRACES,
                        help=f"trace JSONL (default {DEFAULT_TRACES})")
    parser.add_argument("--out-dir", type=Path, default=None,
                        help="bundle output dir (default SHADOW_HEAD_TIER_A_DIR "
                             "or ~/.allternit/shadow-head/tier-a)")
    parser.add_argument("--base-model", default=None,
                        help="HF repo for the base encoder (default answerdotai/ModernBERT-base)")
    parser.add_argument("--epochs", type=int, default=12)
    parser.add_argument("--scorer-lr", type=float, default=1e-3,
                        help="learning rate for the bilinear scorer (fresh MLP)")
    parser.add_argument("--encoder-lr", type=float, default=2e-5,
                        help="learning rate for the encoder (--tune-encoder only)")
    parser.add_argument("--batch-groups", type=int, default=32)
    parser.add_argument("--brier-weight", type=float, default=0.5)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--tune-encoder",
        action="store_true",
        help="end-to-end fine-tune of the encoder (slow on CPU); default trains "
             "only the scorer over a frozen cached encoder — the right recipe "
             "for small trace sets",
    )
    args = parser.parse_args(argv)

    from core.tier_a_head import TIER_A_BASE_MODEL, default_model_dir, train_tier_a
    from core.tier_a_traces import load_traces, split_counts

    traces = load_traces(args.traces)
    out_dir = args.out_dir or default_model_dir()
    print(f"training on {len(traces)} traces {split_counts(traces)} -> {out_dir}")
    metrics = train_tier_a(
        traces,
        out_dir,
        base_model=args.base_model or TIER_A_BASE_MODEL,
        epochs=args.epochs,
        scorer_lr=args.scorer_lr,
        encoder_lr=args.encoder_lr,
        batch_groups=args.batch_groups,
        brier_weight=args.brier_weight,
        seed=args.seed,
        tune_encoder=args.tune_encoder,
        log=lambda msg, *a: print(msg % a if a else msg, flush=True),
    )
    print(json.dumps(metrics, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
