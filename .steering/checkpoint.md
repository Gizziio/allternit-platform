# Steering checkpoint

Goal: Fix stale @allternit npm registry — refresh the 5 core packages stale since 2026-04-14 and make archived card plugins honest.

Just did:
- Drift check: all 5 core packages (api-client, plugin-sdk, workflow-engine, ix, viz) drifted since 2026-04-14; the 15 archived card plugins had exactly 1 commit (2bda61382, a CI script rename) — cosmetic, NOT real drift.
- Decision: republish the 5 core with patch bumps; DEPRECATE the archived card plugins instead of fake-refreshing dead packages.
- Wrote generic gated workflow .github/workflows/publish-package-npm.yml (workflow_dispatch, path+version inputs, path whitelist, standalone npm install to dodge the pnpm workspace name conflict, build, exports sanity, idempotent publish, tarball verify).
- Bumped versions: api-client 1.0.2, plugin-sdk 1.0.2, workflow-engine 0.1.1, ix 0.1.1, viz 0.1.1.

Next: commit + push, dispatch 5 workflow runs, watch first to green, then npm deprecate the 15 archived card plugins, ledger entry.

Open questions: none — plugin-sdk naming consolidation stays deferred (ledger note).
