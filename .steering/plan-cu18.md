# Plan — cu18 P2: stagehand-batch-fork planning-loop consumption

Spec: `Research/specs/stagehand-batch-fork.md` (P2 phase, product contract, REPL semantics ADOPT/DEFER).
P1 (PR #430) landed: Rust batch grant gate + `/api/aci/batch` in `cmd/allternit-api/src/aci_batch.rs`.

## Deliverables (commit each)

- [ ] D1a: `domains/computer-use/docs/session-preservation-contract.md` — doc-first hard gate.
- [ ] D1b: run-scoped batch-context record on the canonical EventLedger (opened at batch
      start, closed at batch end: batch id = descriptor hash, step-count/methods metadata,
      receipt pointer). Wired via an injectable ledger callback on PlanningLoop; gateway
      passes `_emit_canonical`.
- [ ] D2a: `core/batch_dispatch.py` — vision-action → 11-action whitelist mapping
      (click/fill/type→fill/scroll→scrollTo/double_click→doubleClick/key→press),
      descriptor build, `AciBatchClient` (httpx → `{ALLTERNIT_API_URL}/api/aci/batch`,
      `x-allternit-internal-token`), 403 confirmation_required → existing human approval
      flow → retry (approvalId for one-grant; stepApprovalIds[step_index] for per-step).
      No Python-side ConfirmationClass duplication — Rust decides.
- [ ] D2b: `planning_loop.py` — when a plan carries ≥2 consecutively groundable
      whitelist actions (new optional `ActionPlan.batch`), emit one batch turn instead
      of step-by-step; observation returns to existing LoopStep fields; halt-at-first-
      failure → re-plan from post-batch observation (no silent retries of skipped steps).
- [ ] D2c: `vision_providers.py` — additive optional `batch` field on ActionPlan +
      ACTION_PLAN_JSON_SCHEMA + `_parse_action_plan` + planning prompt mention.
- [ ] D2d (small Rust, tested): include `step_index` in the per-step denial body so the
      engine can place per-step grants without duplicating policy. Update aci_batch test.

## Verification

- `cargo test -p allternit-api --lib aci_batch`
- pytest `domains/computer-use/core/tests` before/after counts (CARGO_TARGET_DIR=shared).
- Live smoke: allternit-api (shared warm target) + sidecar + local test page:
  plan → grant handoff → batch execute → receipt; engine-level via PlanningLoop mock.
- turns-per-task before/after on canned 3-step task (measurement substrate for P3).

## Boundaries

No Rust grant-policy changes, no pricing, no desktop release path, no P4 code mode.
