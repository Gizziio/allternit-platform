# Plan — cu28: surface HAR record→teach→batch→verify across product surfaces

Goal (joe, 2026-09-14): the landed cu27 capability (PR #499) goes into the
workspace computer-use surface and all the surfaces: HTTP API, console UI,
desktop/phone-remote consumption.

Quota: commit after every sub-deliverable; at 90 min stop, push, PR, report.

## S1 — HTTP surface (gateway)
New additive router `domains/computer-use/core/gateway/network_traces_router.py`,
prefix `/v1/browser-skills` (same family as browser_skills_router):

- `GET  /v1/browser-skills` — list workflow specs (skill packages on disk):
  distilled summary per spec (id, title, step count, hasNetworkTrace,
  trace entry count). No step bodies, no raw HAR, ever.
- `GET  /v1/browser-skills/{skill_id}` — inspect one spec: distilled shape
  (workflowId/title/provider, step summaries, safety counts, full
  networkTrace — shapes only by construction). 404 unknown, 422 invalid.
- `POST /v1/browser-skills/verify` — run the deterministic chain.
  Body: `{workflow? | skill_id?, target_url?, wait?}`.
  - No target: canned self-check via scripts/har_chain_e2e.run_chain
    (record→teach→batch(1 grant)→verify against the local canned site).
  - With target_url + spec carrying networkTrace: batch+verify leg via
    WorkflowRunner + the chain's local HAR-capturing executor against the
    target. Deterministic verdict from compare_traces.
  - Refusals: unknown skill 404; target without networkTrace 400; non-http(s)
    target 400. Async like the runs idiom: returns verify_id, pollable.
- `GET  /v1/browser-skills/verify/{verify_id}` — stored verdict: network
  status + deviations, a11y (or unverifiable), receipt id/hash, trace.
- `GET  /v1/browser-skills/verify/{verify_id}/receipt/check` — recomputes the
  content-derived receipt hash (same canonical-hash machinery as the chain)
  and reports valid/tampered. Distilled only.
- Registered in gateway/main.py next to browser_skills_router.
- Tests: gateway/tests/test_network_traces_routes.py — shape + refusal cases
  + one canned-chain run + one target-mode pass/mismatch run (local site).

## S2 — Console panel
Extend the console's existing computer-use area (ui/remote-control — where
RecordingsPanel lives; do NOT fork a new page):
- `ui/remote-control/api/workflows.ts` — typed client mirroring recordings.ts.
- `ui/remote-control/recordings/WorkflowsPanel.tsx` — list specs, inspect
  NetworkTrace, run verify (canned or target), view verdict + deviations +
  receipt check. RecordingsPanel idioms (phosphor icons, CSS vars, toasts).
- Mount next to RecordingsPanel in DashboardPage.

## S3 — Desktop / phone-remote
- Desktop (surfaces/allternit-desktop): consumes ACU gateway via
  acu-gateway-manager (base URL config). New routes live on the same
  gateway/host — verify route registry/base URL coverage; add verify status
  line only if an existing computer-use view is present.
- Phone-remote (surfaces/phone-remote): check for any computer-use view;
  if none, document in PR (API reachability is the deliverable).

## Verify
- pytest nine computer-use suites (113 baseline) + new route tests.
- node scripts/release-preflight.mjs (26/0).
- Console typecheck/build if in CI scope.

## Landing
Push, PR (evidence-rich), wait checks (ignore Vercel legacy), merge --merge,
attestation + LEDGER via detached worktree push to main, remove worktrees,
delete branches, report.
