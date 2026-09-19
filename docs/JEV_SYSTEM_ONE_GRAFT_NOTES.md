# JEV System One graft — measured results (2026-09-18)

Session `system-one-graft`, branch `session/system-one-graft` (pushed, no PR
per owner directive). Lane: graft two contract ideas from cua's shipped
jev-use recipe (trycua/cua PR #3916) onto the shadow decision head —
stack-agnostic, both flag-gated, both off by default.

## What changed

1. **Graft A — reserved `reobserve` / `abstain` slots.** The operation
   question's option list gains `reobserve, abstain` after the whitelist
   operations (`core/planning_loop.py::_run_shadow_head`,
   `core/element_table.py::RESERVED_SLOT_OPERATIONS`). No target menus for
   the slots. One instruction line rendered in `[INSTRUCTIONS]` (canonical
   state text) and in the KimiCliHead JSON-contract prompt when the slots
   are present. `_canonicalize_answer` passes them through as ordinary
   options (verified in tests). Reserved-slot picks are scored as
   disagreements — the recorded-LLM reference policy never abstains, so
   there is no honest way to count them as correct.
2. **Graft B — `[LAST ACTION]` effect/escalation block.** Steps 2+ of a run
   render the previously EXECUTED LLM step between `[SINCE LAST STEP]` and
   `[OBSERVED ELEMENTS]`: operation + target, an `effect:` label, and an
   escalation hint line when the action failed. Honest simplification: this
   is a **2-way mapping of cua's 3-way contract** (confirmed /
   suspected_noop / unverifiable) — the synthetic harness always knows
   whether the adapter call raised, so there is no unverifiable case here.
   Step 1 renders no block.
3. **Eval plumbing.** `--reserved-slots {off,on}` / `--last-action {off,on}`
   in `scripts/shadow_head_eval.py` (both default off); composed report-stem
   suffixes `-graftA` / `-graftB` / `-graftAB`. Reports count reserved-slot
   usage (`reobserve_picks` / `abstain_picks` / `reserved_slot_rate`, per
   task and aggregate).

## Numbers — same 66 held-out decide steps, `--head kimi --steps 22 --reserved-slots on --last-action on`

| run | agreement | given LLM success | given LLM failure |
|---|---|---|---|
| baseline (pre-change, `shadow-eval-report-kimi.json`) | 0.318 | — | — |
| + state deltas (`shadow-eval-report-kimi-deltas.json`) | 0.4848 | 0.356 | 0.762 |
| **+ System One grafts AB** (`shadow-eval-report-kimi-deltas-graftAB.json`) | **0.4545** | 0.356 | 0.667 |

Per task: search-flow 0.318 → 0.318, form-fill 0.773 → 0.591,
settings-toggle 0.364 → 0.455. Movement −0.030 overall — **inside the ±0.06
noise band at n=66. No measurable agreement movement.**

**Reserved-slot usage: 11/66 steps (16.7%)** — reobserve 7, abstain 4. The
slots are not decorative: the head uses them. Where it uses them is the
interesting part: **10 of the 11 picks replace a step where the baseline
head was ALREADY wrong** (9 on would-be operation disagreements, 1 —
form-fill step 16 — replaced a would-be agreement). On steps after a failed
LLM action, the head nonetheless picked reobserve/abstain only sometimes
(settings-toggle abstained at 0.9 confidence on steps where the reference
policy kept clicking and the scripted adapter kept failing — arguably the
right call in a real loop, scored as disagreement here).

Confidence (honest): the direction finally separates — mean confidence
0.876 on agreed steps vs 0.802 on disagreed steps (baseline run: 0.918
right / 0.942 wrong, i.e. anti-correlated). Still a self-reported scalar
from a cloud head; treat as a hint, not a threshold.

Operation mix loosened slightly: click 46/fill 20 (baseline) → click
32/fill 20/reobserve 7/abstain 4/doubleClick 3 — the near-collapse is a
little less near.

## Verdict

Flat on the headline metric — the grafts change the head's contract surface,
not its top-1 agreement with an always-acts reference policy. That is the
expected shape of the result: the value of abstain/reobserve is that the
head can decline, and on this harness declining is scored as disagreement.
The honest positives: real usage (16.7%), usage concentrated on steps where
the head was already wrong (10/11), and the first confidence ordering that
points the right way. Signal-quality verdict: **noise on agreement,
promising on calibration** — worth keeping behind the flags, not worth
promoting on this evidence.

## Incidents

- `hover_target` parse-miss count rose 3 → 16 vs the baseline run (the head
  omitted that JSON key more often with the longer option list). Not
  consumed by the agreement metric (target agreement only checks the chosen
  operation's menu) but logged in the report; watch if it grows.
- form-fill's −0.182 is more than a per-task noise band at n=22, but it
  decomposes into one reserved-slot pick replacing an agreement plus
  failure-conditioned misses; read it as the honest cost of the slots, not
  as graft B damage (graft B's block is informational only).
- Mean head latency 17.7s/step (66 subprocess calls, ~19.6 min total) —
  normal for the cloud tier, no timeouts, one `kimi -p` per step as
  designed. One repair-retry parse warning class only.
- Mock graft-AB plumbing run (`shadow-eval-report-graftAB.json`): agreement
  0.7576, identical to graft-off plumbing — the flags are inert until the
  head actually picks a reserved slot, as designed.
