# 2026-09-12 1855 — session/cu18-batchloop — P2: planning-loop batch consumption (kimi)

**PR:** #433 (merged, merge SHA `3d7ca3f51c0de8d32e86686275443a342f58c148`)
**Spec:** `Research/specs/stagehand-batch-fork.md` phase P2. P1 = PR #430 (Rust batch grant gate).

## What was done

P2 of the vendored-runtime batch work: the computer-use planning loop now consumes
P1's batch grant surface, behind the spec's hard gate — the session-preservation
contract landed first, as its own commit.

### D1 — Session-preservation contract (doc-first gate)
- `domains/computer-use/docs/session-preservation-contract.md` (v1): the four
  state surfaces per run (runs.sqlite3, canonical EventLedger, recordings index,
  sandbox_env); what survives a batch boundary (browser/page state — never
  implicit model scratch state); the binding rule that cross-batch state is
  carried only as explicit ledger/receipt writes; the `os.environ`
  last-writer-wins concurrent-run tradeoff named honestly (v1, not solved);
  versioning rules.
- `domains/computer-use/core/core/batch_context.py`: the single new record type —
  `batch.context.opened` (before the batch RPC, audit-before-act) and
  `batch.context.closed` (status, halt position, receipt pointer,
  `model_turns_saved`) on the existing canonical EventLedger. Method names only;
  arguments (typed text) never enter the record.

### D2 — Planning-loop batch consumption
- `core/batch_dispatch.py`: vision-action → 11-action whitelist mapping
  (selector-like targets only), `AciBatchClient` (`POST /api/aci/batch`), and
  policy-free grant-retry placement. ConfirmationClass / batch-vs-per-step
  policy stays entirely Rust-side.
- `core/planning_loop.py`: plans carrying N≥2 groundable whitelist actions
  (optional additive `ActionPlan.batch`) dispatch ONE grant-bound batch; the
  observation returns to the existing LoopStep fields; halt-at-first-failure is
  reported honestly and the loop re-plans from the post-batch observation;
  declined/failed grants and unbatchable plans fall back to step-by-step.
  `model_turns` counted per run (P3 substrate). Optional `batch_page_url`
  descriptor binding (the loop does not track the browser URL; operators pin it).
- `core/vision_providers.py`: optional `batch` field on ActionPlan + JSON schema
  + parser + prompt mention.
- `gateway/computer_use_router.py`: wires the canonical ledger into the loop and
  passes `batch_enabled` / `batch_mode` / `batch_page_url` options.
- Small Rust change (`aci_batch.rs`): per-step denial body now names `step_index`
  so the engine places per-step grants without re-deriving the taxonomy.
  No grant-policy change. 19/19 `cargo test -p allternit-api --lib aci_batch`.

## Verification

- `cargo test -p allternit-api --lib aci_batch` — 19/19.
- Targeted Python suite (`domains/computer-use/core/tests`, repo venv):
  BEFORE (origin/main) 133 passed / 7 failed; AFTER 155 passed / the same 7
  failures — all pre-existing in `test_gateway_execute_direct.py`, identical
  list on main. +22 new tests (test_batch_dispatch, test_batch_context) green.
- Live smoke on the real stack (allternit-api :18113 + vendored runtime sidecar
  with headless Chrome + local test page), all 16 checks PASS:
  - HTTP leg: 3-step batch → `confirmation_required` (descriptor hash) →
    `/aci/handoff/:id/approve` → batch executes in real Chrome → receipt
    `completed` 3/3 steps, `one_grant`, retrievable by id.
  - Engine leg: PlanningLoop → grant flow → batch → observation →
    `batch.context.opened/closed` with receipt pointer.
  - Turns-per-task on the canned 3-step task: **4 turns step-by-step → 2 turns
    batched** (the P3 measurement substrate, live numbers).
- `pnpm run build` for `allternit-browser-runtime` green (exercised as the smoke
  dependency; no TS changes in this PR).
- `node scripts/release-preflight.mjs` — 35 passed, 0 failed.
- PR checks: all GitHub Actions green; Vercel checks failed on account-wide
  deployment rate limiting (retry in 24h) — unrelated to the diff.

## Incidents / environment notes

- Full unfiltered `tests/` suite hangs in e2e/real-adapter tests on BOTH
  origin/main and this branch (pre-existing); targeted subset used instead.
- Shared `.venv`: removed a macOS quarantine xattr that made `pydantic_core`
  unloadable (pre-existing, hit both branches); installed pytest/pytest-asyncio
  into that venv via uv (it only had the runtime deps).
- Port 8013 was already occupied by another allternit-api instance; smoke used
  ALLTERNIT_API_PORT=18113 with ALLTERNIT_LOCAL_DEV_BYPASS=1.

## Honest deferrals

- **record→teach→batch**: taught workflows compiling to a batch did not fall out
  naturally; the deterministic workflow runner is untouched. Deferred to a later
  phase — the batch descriptor shape is ready for it.
- Real-model batch planning (a vision provider actually emitting `batch`) is
  wired but unexercised with a live model — no vision API key in the build env;
  the smoke used a scripted provider against the real grant/execute path.
- Batch context scratch (spec REPL ADOPT #1) is documented as discarded per
  batch; nothing Python-side reads/writes it yet — it is runtime-internal.
