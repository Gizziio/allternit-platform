# Attestation — session/cu17-batchgate (stagehand-batch-fork P1)

**Date:** 2026-09-12 ~14:37 local
**Agent:** Kimi Code (subagent, P1 execution of approved spec `stagehand-batch-fork`)
**PR:** #430 → merge SHA `96c97f220f96d7577eb9977659fc1a229c92e9d2` (merge commit)
**Branch:** `session/cu17-batchgate` (deleted after landing)
**Spec:** `Allternit Brain/Research/specs/stagehand-batch-fork.md` phase P1 (P0 = PR #415 already merged)

## What was done

Three slices + one fix, all verified before merge.

**Slice 1 — batch grant gate (Rust, the differentiator).** New
`cmd/allternit-api/src/aci_batch.rs`. Batch descriptor = canonical
`{origin, session, pageUrl, ordered steps[]}` where each step is one of the 11
actions the vendored runtime executes deterministically
(`SupportedUnderstudyAction` in the vendored extension). The descriptor SHA-256
reuses `aci_approvals::hash_action_payload`, so one grant per batch is
single-use, expiring, and hash-bound exactly like per-action grants, drivable
through the existing `/api/aci/handoff/:id/approve` flow. Enforcement plans:
all-reversible batches auto-pass (mirrors the per-action reversible skip);
explicit `mode=batch` enforces one grant once before dispatch; the
conservative default for anything not clearly reversible is per-step grants
bound to `(batch hash, step index, step payload)`. Batch receipts record
descriptor hash, grant id, per-step outcomes, and halt position; the
dispatched row is JSONL-persisted BEFORE the sidecar dispatch
(audit-before-act, same ordering as the openbot-policy-gateway spec). Routes:
`POST /api/aci/batch` (P2 planning-loop substrate, deliberately no planning
logic) + `GET /api/aci/batch/receipts/:id`. Sidecar gained `actBatch`:
structured whitelisted steps over ONE `experimentalBatch` transport call,
in-worker dispatch, halt at first failure, zero model calls. Supporting
edits: `HOST_POLICY` → `pub(crate)`, `ConfirmationDenial` derives `Debug`,
`ActionGrantStore::set_expires_for_test` (cfg test).

**Slice 2 — gateway-routed inference + residency scrub.** The sidecar's
client-LLM callback (`model: {source:"client", generate}`) now routes through
the allternit gateway: `POST {ALLTERNIT_GATEWAY_URL}/v1/chat/completions`
(default `http://127.0.0.1:8013`) with the `ALLTERNIT_GATEWAY_KEY` Bearer
virtual key; `response_format` mapped from the extension's JSON-schema
request; model from `ALLTERNIT_BROWSER_RUNTIME_MODEL` or `claude-sonnet-5`
(A://C backend per `Infra/model-routing.md`). Fail-closed: unreachable
gateway / missing key / non-JSON structured output are errors. The P0
direct-provider mode is removed — no model call uses a direct provider key
and no path to the Browserbase Model Gateway exists. Scrub: the inert
`DEFAULT_BROWSERBASE_URL` constant was removed from `clientSchemas.ts` (the
inert browserbase factory now requires an explicit baseUrl — parse-time
fail-closed); after rebuild `grep -r browserbase.com packages/sdk-ts/dist`
returns nothing (it previously survived into the built service worker via the
extension's cross-package SDK-source import). VENDORED.md updated.

**Slice 3 — ActionIntent coverage + screenshot hashing.** The sidecar and
`@allternit/browser`'s `StagehandSidecarProvider` now implement the
previously-erroring kinds: `tab.open/focus/close` (vendored SDK
`BrowserContext` page surface; `pageId` IS the CDP targetId on both sides),
`dialog.accept/dismiss` (host-side raw CDP on the page target —
`Page.enable` → `javascriptDialogOpening` → `handleJavaScriptDialog`; the
upstream extension protocol has NO dialog operation and nothing was invented
that the extension cannot execute), `file.upload` (path entries
containment-checked against the run-scoped sandbox dir, escapes refused;
base64 payloads inline), `download` (listing only — Chrome is pinned to the
sandbox downloads dir via `Browser.setDownloadBehavior` at launch, so
downloads can never land at an arbitrary path). Screenshots return a SHA-256
captured at the same moment as the pixels, carried in the event payload so
receipt metadata binds the exact pixels observed. Provider defaults each run
to `<tmpdir>/allternit-browser-runs/<runId>` (sanitizeRunId) so concurrent
runs never share a file surface.

**Fix (found by the live smoke).** The Rust sidecar NDJSON client treated a
250 ms recv-slice timeout as fatal, so any call slower than the slice (init
launches Chrome) failed as "timed out". Slices now continue until the real
deadline; only deadline exhaustion or channel disconnect fails the request.

## Verification evidence

- `cargo test -p allternit-api aci`: **70 passed / 0 failed** (baseline before
  change: 51 / 0; +19 new batch-gate tests, no regressions). One transient
  failure of main-side `policy_seat_tests::audit_api_returns_rows_with_bot_filter`
  observed once right after the merge (expected 3 audit rows, saw 25): a
  latent pre-existing test-isolation race (`ALLTERNIT_COMPUTER_USE_DIR` is a
  process-global env var read live by `policy_audit_path()`), timing-exposed
  by added parallel load. Reproduced never: 3/3 subsequent parallel runs
  70/0, single-threaded 70/0, the test alone green, and origin/main itself
  passes only by timing (51/0). Not a regression from this PR's code paths
  (batch routes never touch the policy audit store). Worth a follow-up
  isolation fix in `policy_audit` tests.
- Runtime: `pnpm run typecheck` + `pnpm run build` green (publint clean);
  `@allternit/browser` `tsc --noEmit` green.
- Smoke (`smoke-stagehand.ts --mock-model`): **11/11 PASS** — init, act,
  observe, extract, experimentalBatch, provider stub, screenshot-sha256
  verified against the base64 bytes, tabs open/focus/observe/close, dialog
  accept over host CDP, sandbox upload + escape refusal, attachment download
  with on-disk byte verification.
- `@allternit/browser` `npx vitest run`: **89 passed** (matches P0 baseline).
- **Live gated-batch smoke** against a running gateway
  (`ALLTERNIT_LOCAL_DEV_BYPASS=1 ALLTERNIT_API_PORT=8123`) + real Chrome on a
  local test page, scripted (`python3`, stdlib only): **11/11 PASS** —
  request-without-grant → 403 `confirmation_required` (+`approval_id`,
  descriptor hash) → approve via `/api/aci/handoff/:id/approve` → granted
  batch executes through the sidecar → 200 receipt (descriptor hash, grant
  id, 3 completed steps) → `GET /api/aci/batch/receipts/:id` round-trips →
  replay with consumed grant → 403 `approval_denied` (single-use) → tampered
  descriptor → 403 → batch with a missing element → receipt
  `completed_halted`, `halted_at: 1`, tail `skipped`.
- `node scripts/release-preflight.mjs`: **35 passed / 0 failed** (desktop
  release path untouched by the PR; the check count has grown past the 26/0
  the commandment cites).
- PR #430 checks: all GitHub checks green (Desktop vitest, Typecheck/build,
  Cloudflare Pages, gitleaks, validate-typography, sw-cache-bump). The three
  Vercel checks fail with an account-level "Deployment rate limited — retry
  in 24 hours" — environmental, unrelated to this PR.

## Incidents / notes

- Port 8013 on this machine is held by a long-running gateway from another
  session; the live smoke used `ALLTERNIT_API_PORT=8123`. Later sessions:
  don't kill that process; pick your own port.
- First live-smoke attempt deadlocked on a modal alert fired during
  navigation (the sequential NDJSON flow awaits navigate while the dialog
  blocks the loader). The smoke defers the alert past the load event. Not a
  product bug.
- The smoke script's cross-package import of `remote-provider.ts` requires
  the repo-root workspace installed in the worktree (fresh worktrees need
  `pnpm install` at root before `tsx` can resolve
  `@allternit/computer-use-protocol`).

## Honest deferrals

- P2 items untouched per boundaries: Python ACU planning-loop batch
  consumption, session-preservation contract (a P2 deliverable per the spec).
- Batch size cap is an absolute bound (50 steps); per-risk-taxonomy size caps
  (spec's mitigation knob) land with P2/P3.
- Gateway model mode is implemented and fail-closed but was not exercised
  against a live gateway with a real virtual key (no `ak-...` key in the
  build env); mock mode covered all runtime verification.
- The `policy_seat_tests` isolation race noted above is pre-existing; fixing
  it belongs to a session touching `policy_audit`.
