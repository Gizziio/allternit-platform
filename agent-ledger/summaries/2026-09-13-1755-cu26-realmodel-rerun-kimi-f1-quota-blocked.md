# session/cu26-realmodel-rerun — F1 re-verification campaign: quota-blocked, F2 integration crash found + fixed

- **Date:** 2026-09-13, 17:55 local
- **Agent family:** kimi-code (orchestrated subagent)
- **Spec:** `stagehand-batch-fork.md` §D3/cu24 follow-up — "a frontier-model re-run to confirm turn-saving at campaign scale is the natural cu25+ target"
- **PR #488**, merge `6e5c2873e`; branch `session/cu26-realmodel-rerun`

## What was done

Re-ran the cu22 real-model campaign harness (adapted to `tmp-cu26-realmodel/`, own
ports 18081/9223/18133-class isolation so the cu22 leftovers and the Desktop's
debug port were never touched) against **fixed main** (PR #480 F1 + PR #484
migration fix). Three arms planned over the same five task shapes: per-step
baseline, batched pre-F1 semantics (client-side `post_batch_observation` strip —
faithful, no product code touched), batched with F1.

**The campaign did not complete: the codex-CLI ChatGPT-account usage limit
tripped mid-run** (account-level; resets 2026-09-20 12:08 AM; the ak- gateway has
no provider key in dev, so there is no alternate frontier path). Per the campaign
honesty rules the run stopped there — 27 real calls, every token count logged, no
synthetic numbers.

## What was verified before the block

- **PR #484 first-hand:** fresh dev DB applied all 167 refinery migrations with
  zero errors; the batch grant gate served the full descriptor/auth/handoff cycle.
- **Brain path healthy:** smoke logged a real gpt-6-astra inference — 31,758 in /
  60 out tokens, 12.9 s (cu22 logged 31,608/70 — same path, same shape).
- **26 further real calls** (586,805 in / 1,556 out tokens) drove the per-step
  baseline arm before quota died. Evidence: `tmp-cu26-realmodel/evidence/`
  (per-call JSONL, per-run campaign JSON, dispatch logs).

## Campaign-found regression — fixed in PR #488 (`607287aa9`)

The cu24 **F2** `PLAN_ACTION_MAP` translation crashed on the *real* planning-loop
path: `planning_loop._execute_action` builds a plain `ActionRequest`-like object,
not a dataclass, so `dataclasses.replace` raised *"replace() should be called on
dataclass instances"* for every mapped plan type. cu22 never saw it (harness
shim); cu24's suite tested dataclass inputs only. **Per-step execution of any
mapped plan type was broken end-to-end on main.** Fix: `replace` for dataclasses,
shallow copy otherwise; two integration-shape regression tests added. Suites
76/76; release-preflight 36/0.

## Verdict on F1

**Unchanged — still scripted-verified only.** The partial per-step numbers (e.g.
form-fill 12 turns / 2-of-12 steps) are contaminated by the F2 crash and the
quota cutoff; they are forensics, not campaign data. The decisive three-arm
comparison is the open follow-up, gated only on CLI-brain quota (2026-09-20) and
unblocked on the per-step arm by the F2 fix. `docs/public/aci/safety.md` carries
the honest cu26 subsection; no existing measured claim was weakened.

## Incidents

- First API launch bound 18113 without `ALLTERNIT_LOCAL_DEV_BYPASS` (401s); a
  SIGTERM didn't take and the relaunch panic'd on AddrInUse — SIGKILL + clean
  relaunch fixed it. Root cause of the 401 is documented in the plan file.
- Codex CLI masks quota exhaustion as "Reading additional input from stdin...";
  the campaign wrapper's error capture was tightened to surface `turn.failed`
  messages so the next session sees quota state immediately.

## Deferrals

- **The campaign itself** — resume after the codex CLI quota resets
  (2026-09-20 12:08 AM local): run `--arm f1 --mode batched` and
  `--arm pre-f1 --mode batched` for all five tasks, then per-step with the
  now-fixed executor. Harness is committed and ready.
- Desktop rebuild from merged main not run (Python/docs-only diff; same
  deferral class as cu23/cu24).
- Brain spec (`stagehand-batch-fork.md`) cu24 block update — the safety card is
  the landed record; the spec status line belongs to the next session that
  completes the re-run.
