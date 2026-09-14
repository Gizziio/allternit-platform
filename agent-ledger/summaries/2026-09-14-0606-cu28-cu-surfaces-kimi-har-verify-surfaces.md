# Attestation — session/cu28-cu-surfaces — HAR verify across product surfaces

Agent: Kimi Code (cu28). Spec: Research/specs/har-network-traces.md (open
"surfaces integration" item; joe 2026-09-14: "supposed to go into allternit
workspace computer use and in all the surfaces"). PR #503, merge 2a8a6b2d6.

## What shipped

- **S1 — gateway HTTP surface** (`domains/computer-use/core/gateway/network_traces_router.py`,
  additive, registered in `main.py`): `GET /v1/browser-skills` (list specs,
  distilled summaries), `GET /v1/browser-skills/{skill_id}` (inspect, distilled
  steps + full taught NetworkTrace, shapes only), `POST /v1/browser-skills/verify`
  (canned deterministic self-check reusing `scripts/har_chain_e2e.run_chain`, or
  batch+verify a spec'd workflow against a target URL via WorkflowRunner + the
  chain's one-grant HAR executor; refusals 400/404, async verify_id + poll),
  `GET .../verify/{verify_id}` (verdict: network pass/deviated + exact-match
  deviations, a11y or honest `unverifiable`, receipt id/hash),
  `GET .../verify/{verify_id}/receipt/check` (canonical-hash recompute, tamper
  detection). Raw HAR never crosses the API; per-verify temp HARs deleted before
  the verdict is published; scrub failure fails closed; no grant/scrub/compare
  semantics touched.
- **S2 — console** (surfaces/ai.allternit.com remote-control Dashboard, the
  existing computer-use area, Workflows section under Recordings):
  `api/workflows.ts` typed client + `recordings/WorkflowsPanel.tsx` (spec list,
  NetworkTrace inspection, self-check + target verify runners, verdict view with
  deviations/a11y/receipt-hash tamper check).
- **S3 — consumption**: SDK `AllternitComputerUseClient` gains 5 typed methods
  (`js/src/computer-use.ts` + committed `dist/` artifacts). Desktop reaches the
  routes through its existing gateway base-URL chain (no whitelist — verified,
  zero desktop-code change; desktop has no native computer-use view, none built).
  Phone-remote has no computer-use view/config — documented deferral, no UI built.
  Contract doc: `domains/computer-use/docs/network-trace-surfaces.md`.

## Verification

- New gateway route tests (`gateway/tests/test_network_traces_routes.py`):
  **14 passed** — distilled-shape assertions (step payload values asserted
  absent), refusal cases (404/409/422/400), canned self-check pass
  (canary_absent=true, a11y zero, receipt check valid), target-mode pass,
  drifted trace → `missing_call`/`extra_call` deviations + valid receipt, and
  two consecutive target verifies with identical verdicts + receipt hashes.
- Regression, 11 computer-use suites: **166 passed / 8 failed / 5 errors —
  identical to the pre-change baseline** (same counts documented at the cu27
  landing; pre-existing fastapi-missing HTTP fixtures + asyncio fixture errors).
- `node scripts/release-preflight.mjs`: **36 passed, 0 failed**.
- Console vitest: **25 passed** (10 new + 15 existing recordings tests).
  tsc --noEmit: 0 errors in touched files (22 pre-existing elsewhere under
  locally symlinked node_modules skew; CI typecheck on main green).
- PR #503 checks: Desktop CI (unit + typecheck/build desktop), gitleaks,
  sw-cache guard, typography — all green. Vercel + Cloudflare-Pages git-app
  checks are legacy (rate-limit/pending on merged PRs too) — ignored.

## Incidents

- None. First pytest baseline run used the system python (missing deps) —
  rerunning under the shared checkout's `.venv` reproduced the documented
  baseline exactly.

## Deferrals

- Phone-remote verify UI: no computer-use surface exists there; if wanted
  later, consume the SDK methods against the paired machine's gateway.
- Desktop binary rebuild (session-lifecycle step 8): the change touches the
  console the desktop bundles — the post-merge rebuild is the standard next
  step; left for the owner queue, not blocking (release-preflight green).
- `gateway/routes_registry.py` self-documentation: browser-skills routes were
  never registered there either; kept parity (additive only).
