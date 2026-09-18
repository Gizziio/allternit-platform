---
status: done
date: 2026-09-18
branch: session/jev-kimi-head
files_changed:
  - domains/computer-use/core/core/decision_head.py
  - domains/computer-use/core/core/shadow_eval.py
  - domains/computer-use/core/scripts/shadow_head_eval.py
  - domains/computer-use/core/tests/test_decision_head.py
  - domains/computer-use/core/tests/test_shadow_eval_smoke.py
  - domains/computer-use/core/evaluation/shadow-eval/shadow-eval-report-kimi.json
  - domains/computer-use/core/evaluation/shadow-eval/shadow-eval-report-kimi.md
  - domains/computer-use/core/evaluation/shadow-eval/shadow-eval-report-kimi-sequential.json
  - domains/computer-use/core/evaluation/shadow-eval/shadow-eval-report-kimi-sequential.md
  - docs/JEV_KIMI_HEAD_NOTES.md
deviations:
  - "The batched report's aggregate 'note' field was patched in place after the run: the run predated a one-line fix in core/shadow_eval.py that selects the report note by head_label (kimi got the mlx note text). Only the note string changed; every measured number in both artifacts is untouched from the run output. The fix itself is committed in this branch."
  - "Latency inflation late in the sequential run: settings-toggle steps degraded from ~50s to ~100s per step (p50 57s, max 102s). Most likely CLI-side rate shaping on a long burst of back-to-back calls; the eval has no retry-storm (each step is 2 calls, no failures). Reported honestly rather than re-run — a re-run would face the same burst pattern."
  - "The kimi -p sanity check and both eval runs share the machine's kimi CLI auth (subscription). Auth state was validated before the 30+60-minute runs, per the parallel session's lesson; no credentials are touched by the head (subprocess only)."
  - "uv environment: same deviation as JEV_REAL_EVAL_NOTES.md — uv sync cannot add the shadow-head extra here (stale uv.lock); used uv sync --frozen --extra dev + uv pip install -e '.[shadow-head]' + uv run --frozen --no-sync. This session's core dir started without a .venv; the sanctioned path recreated it."
remaining:
  - "Confidence from kimi is a scalar with near-zero variance across steps (0.93-0.94 mean whether agreeing or not). It cannot serve as a per-step veto signal in either questioning mode. A real calibration signal would need either per-option logprobs (not exposed by the CLI) or an explicit self-rated-certainty prompt per question with a richer scale."
  - "The goal_satisfied/stuck gates are degenerate for this head: kimi answered false/false on all 66 steps in both modes. The gate questions either need stronger prompting (state-evidence requirement) or are only meaningful for local heads."
  - "Sequential's second pass conditions the target menu on the head's own operation choice — when the head's op is wrong, the target question is never asked for the right op, so sequential cannot recover op-level misses. Its identical numbers to batched suggest the bottleneck is step-level conditioning, not menu size."
  - "Target agreement is only scored when ops agree (harness shape); with per-task constant policies, target quality (21/50 = 0.42, above chance) is the only step-sensitive signal kimi carries."
---

# JEV KimiCliHead eval — shadow policy head, cloud-iteration tier (2026-09-18)

Phase 1 + the real-weights session shipped the shadow head with a local
mlx direct-logit tier (Tier B, 0.2273 agreement) and a MockHead. This
session adds the **cloud-iteration tier**: `KimiCliHead`, a
`DecisionHead`-protocol head that drives the `kimi` CLI exactly the way
gizzi's kimi-cli provider does — one `kimi -p "<prompt>"` subprocess per
decision pass. Auth/OAuth stays inside the CLI; the head adds no package
dependency and never touches credentials.

Lessons from the parallel KimiCLIHead session were applied up front:
canonical 11-operation vocabulary with legacy-alias folding in both the
options block and answer parsing (the 0/8 → 3/8 fix there), a strict JSON
contract with one repair retry then a recorded miss (never a crash),
all-questions-batched shape matching the harness, plus a new
`--questioning sequential` mode (operation + gates first, then only the
chosen operation's target menu — 2 calls per step, small menus per pass).

## The numbers (3 tasks × 22 decide steps = 66; LLM side = recorded transcript)

| Metric | MlxDirectLogitHead (reference) | KimiCliHead batched | KimiCliHead sequential |
|---|---|---|---|
| Agreement rate | 0.2273 | **0.3182** (21/66) | **0.3182** (21/66) |
| Agreement given LLM success | 0.3333 | 0.1556 | 0.1778 |
| Agreement given LLM failure | 0.0000 | 0.6667 | 0.6190 |
| Operation agreement | 0.6515 | 0.7576 (50/66) | 0.7576 (50/66) |
| Target agreement (ops agree) | 15/43 = 0.3488 | 21/50 = 0.4200 | 21/50 = 0.4200 |
| Stuck=true rate (all steps) | 0.3333 | 0.0000 | 0.0000 |
| Goal-satisfied=true rate | 0.3333 | 0.0000 | 0.0000 |
| Mean head latency / step | 1704 ms | **27 903 ms** (p50 27 256, max 48 223) | **58 199 ms** (p50 57 410, max 102 200) |
| Mean LLM latency / step | 850 ms (scripted) | 850 ms (scripted) | 850 ms (scripted) |
| Vocab misses | n/a | **1** | **0** |
| Mean confidence agreeing | 0.898 | 0.941 | 0.937 |
| Mean confidence disagreeing | 0.721 | 0.939 | 0.928 |
| Wall clock (66 steps) | minutes | ~31 min | ~64 min |

Per task (agreement): batched search-flow 0.3182 / form-fill 0.3182 /
settings-toggle 0.3182; sequential search-flow 0.2727 / form-fill 0.3636 /
settings-toggle 0.3182. Full data: `shadow-eval-report-kimi.{json,md}` and
`shadow-eval-report-kimi-sequential.{json,md}`.

Vocab-miss detail: the single batched miss is one `hover_target`
parse-miss (kimi omitted one speculative target key on one step);
sequential had none in 66 steps. The canonical-vocabulary + JSON-contract
plumbing held: zero alias folds were ever needed (the prompt pins the
exact option strings and kimi complied), and the one omission was caught
by the miss metric rather than crashing or silently defaulting.

## Does confidence separate agree from disagree?

**No — and this is the sharpest negative result of the run.** Mean
confidence when agreeing 0.941 vs 0.939 when disagreeing (batched); 0.937
vs 0.928 (sequential). kimi's confidence is a near-constant ~0.93-0.95
regardless of correctness — it reads as a politeness prior on its own
format, not a calibrated estimate. (mlx, for comparison, did separate
weakly: 0.898 vs 0.721 — a per-option distribution property that survives
entropy collapsing; a scalar self-rating does not.) As a per-step veto
signal, kimi confidence is unusable in both modes.

## Does sequential beat batched?

**No — identical decision quality at 2.1× the latency.** Same aggregate
agreement (0.3182), same operation agreement (50/66), same target
agreement (21/50), same per-task policy choices (click-everywhere on the
two click tasks, fill-21-of-22 on form-fill). Small menus did not change
what the model decides; they only doubled the subprocess bill, and the
late-run latency degradation (up to ~102 s/step on settings-toggle) makes
sequential strictly worse at this task scale. Batched is the right default
for this harness; sequential's value would be menu-size-constrained steps
(target lists >> 64 options), which these three tasks never produce.

## Honest read

KimiCliHead beats the mlx zero-shot head on every agreement number
(0.3182 vs 0.2273 overall; target 0.42 vs 0.349) at a 16× per-step
latency cost (27.9 s vs 1.7 s). But the failure anatomy is the same
disease at a different level: mlx collapsed to a **global** constant
"click" prior; kimi collapses to a **per-task** constant policy (22/22
click in search-flow including all 8 fill steps; 21/22 fill in form-fill
including the click steps; 22/22 click in settings-toggle). It conditions
on task identity, not on step state — operation agreement 0.7576 is
exactly what a per-task policy yields, and the disagreement is systematic,
not noisy. The one genuinely step-sensitive signal is target selection
(0.42 against ~4-6 candidates, chance ~20-25%) — real but weak, and it
never fires on the steps whose scripted failures define the LLM-failure
bucket, hence the inverted success/failure split (0.16 agreeing on
success steps vs 0.62-0.67 on failure steps): the head agrees with the
clicks that fail and misses the fills that succeed. On who is right: the
LLM transcript remains ground truth on every adjudicable disagreement —
kimi's per-task policies would not complete search-flow (the fill step is
unskippable). Combined with the flat confidence, this head is not usable
as a veto gate either; what it buys over mlx is the *iteration speed* of
the cloud tier — prompt changes ship in one subprocess call, no 2.5 GB
weights — which is exactly what it is for. The strongest remaining
argument is unchanged from the mlx session: Tier A (small classifier
trained on labelled shadow.decision traces from this harness) is the path,
and both evals now supply the evidence for it. Also hard-noted for any
production use: 28 s/step (batched) is 33× the scripted LLM step — a
shadow head at this latency is a batch/offline analysis instrument, not
an inline gate.

## How to reproduce

```bash
cd domains/computer-use/core
# one-time env (same deviation as JEV_REAL_EVAL_NOTES.md: stale uv.lock):
uv sync --frozen --extra dev
uv pip install -e '.[shadow-head]'
# sanity-check auth first (one ~25s call):
kimi -p 'Answer with a JSON object only: {"q": {"answer": "click", "confidence": 0.8}}'
# the evals (~31 min and ~64 min; run in background, poll the log):
uv run --frozen --no-sync --extra dev python scripts/shadow_head_eval.py \
    --head kimi --steps 22
uv run --frozen --no-sync --extra dev python scripts/shadow_head_eval.py \
    --head kimi --questioning sequential --steps 22
# tests (no real CLI call in the test path — subprocess always stubbed):
uv run --frozen --no-sync --extra dev pytest tests/test_element_table.py \
    tests/test_decision_head.py tests/test_shadow_hook.py \
    tests/test_shadow_eval_smoke.py -q   # 66 passed, 1 skipped
```
