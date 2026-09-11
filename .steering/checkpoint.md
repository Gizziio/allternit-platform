# Checkpoint — session/rmvercel-0911

## Goal
Remove Vercel from the codebase: dead verceldeploy plugin wiring (hosting
integration we don't use). The Vercel GitHub App that posts PR checks is a
dashboard-side integration — removal steps reported to owner, not code.

## Just did
- Worktree `allternit-session-rmvercel-0911` on `session/rmvercel-0911`
  from origin/main (e6bea0466).
- Removed dead `verceldeploy` MCP server from `.mcp.json` (pointed into
  archive/ — already broken), `.vercel` lines from `.gitignore` /
  `.dockerignore`, the stale `VERCEL_AGENT_PLUGIN_ADAPTER_PHASE_1_TASK.md`
  next-batch doc (plugin archived), the `codex-verceldeploy-plugin` entry
  from the native plugin catalog, the Phase 1 check + expected ids from
  `scripts/validate-codex-plugins.ts`, and all vercel sections from
  `docs/PLUGIN_AND_SERVICE_INTEGRATION.md`.
- Deliberately left: archive/, agent-ledger history, the open-connector
  vercel provider + icons (product connector catalog), the design-system
  library's "vercel" preset + style mentions, the website plugin's
  `deploymentTarget: 'vercel'` option, vendored + THIRD_PARTY files.
- Verified: `.mcp.json` parses; ai typecheck 0 errors; vitest 1650 pass;
  validator script runs (5p/3f — was 5p/4f on clean main; remaining
  failures pre-existing, remotion/iosappbuild also archived).

## Next
- Commit, push, PR, merge; attest; cleanup.

## Open questions
- None.
