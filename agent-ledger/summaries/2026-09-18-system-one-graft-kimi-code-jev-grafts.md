# Attestation — session/system-one-graft (System One contract grafts)

- **Session:** session/system-one-graft (orchestrated; implementation delegated to a coder subagent, claims re-verified by main agent before landing)
- **Date:** 2026-09-18
- **Branch:** `session/system-one-graft` → **PR #648, MERGED** (merge `7c66d508e`)
- **Follows:** PR #626 (state deltas, 0.4848). Spec: `Allternit Brain/Research/specs/jev-policy-head.md` — cua jev-use graft list + keep-vs-scrap verdict (2026-09-18 night).

## What was done

Grafted the two stack-agnostic contract ideas from cua's shipped jev-use recipe (trycua/cua PR #3916) onto the shadow-head system, both flag-gated (default off, byte-identical when off):

1. **Graft A — reserved `reobserve`/`abstain` operation slots** (after whitelist ops, no target menus; prompt instruction line only when present in options). Reserved picks scored as disagreements — the recorded-LLM reference never abstains.
2. **Graft B — `[LAST ACTION]` effect/escalation block** from the real outcome of the previously executed LLM step (`confirmed`/`suspected_noop` + escalation hint on failure; honest 2-way mapping of cua's 3-way contract — no unverifiable case in the synthetic harness; step 1 renders none).
3. Eval plumbing: `--reserved-slots`/`--last-action {off,on}`, composed `-graftA/-graftB/-graftAB` stems, `reserved_slot_rate` metric. 10 new tests (`tests/test_system_one_graft.py`).

## Results — same 66 held-out steps, `--head kimi --steps 22 --reserved-slots on --last-action on`

| run | agreement |
|---|---|
| zero-shot baseline | 0.318 |
| + state deltas (PR #626) | 0.4848 |
| + grafts AB | **0.4545** |

Agreement −0.030 = inside the ±0.06 noise band (no measurable agreement movement — honest verdict). Secondary signals, both real: (a) reserved slots used 16.7% (11/66; reobserve 7 / abstain 4), **10/11 replacing steps where the deltas-only head was already wrong** — the slots behave as a correct uncertainty valve; (b) **confidence ordering inverted the right way**: 0.876 right / 0.802 wrong vs the anti-correlated deltas baseline (0.918/0.942) — first right-directional calibration signal, not yet separation.

## Verification

- `pytest tests/{test_element_table,test_decision_head,test_shadow_eval_smoke,test_shadow_hook,test_system_one_graft}.py -q` — **96 passed, 1 skipped** (main agent re-run; claim verified, unlike the state-deltas session where the subagent's count did not hold).
- Mock graftAB check passed; flags verified inert when off.
- One cloud pass, 19.6 min, exit 0, no leftover processes (verified).

## Incidents / deferrals (honest)

- `hover_target` parse-miss count rose 3→16 (JSON key omission; not consumed by the agreement metric) — documented in the notes; worth a prompt-contract tightening pass later.
- Live trace accumulation for calibration thresholds: still the unwritten next policy — deferred.
- Graft landing rationale: agreement flat, but the abstain mechanism + right-directional calibration are prerequisites for any future promotion decision; ablation per graft was not run (would need 2 more cloud passes — owner controls eval spend).
