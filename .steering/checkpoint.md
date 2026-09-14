# cu28 checkpoint

**Goal:** Surface the landed HAR record→teach→batch→verify capability (PR #499)
across gateway HTTP, console UI, desktop/phone-remote (joe 2026-09-14).

**Just did:**
- S1 (commit c9b533e0f): gateway/network_traces_router.py — list/inspect/verify/
  receipt-check routes on /v1/browser-skills, distilled shapes only, fail-closed.
  14 route tests green (incl. real chain runs: canned pass, target pass,
  mismatch deviations, determinism ×2).
- S2+S3 (commit f051f21cd): console Workflows panel in remote-control Dashboard
  (api/workflows.ts + WorkflowsPanel.tsx + mount), 10 vitest cases green;
  SDK client methods + dist artifacts; surfaces doc.
- release-preflight 36/0. Console tsc: 0 errors in touched files (22 pre-existing
  elsewhere under skewed symlinked node_modules; CI main is green).

**Next:** final pytest suite run (background), then push, PR, merge, attest, cleanup.

**Open questions:** none.
