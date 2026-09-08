# Session cu1-subtree — computerUse subtree rebuild (F → buildable)

- Date: 2026-09-08 (swarm session, orchestrated by Kimi Code goal run)
- Branch: session/cu1-subtree → PR #143 → merge 7b25b8ead

## What was done
`cmd/gizzi-code/src/cli/ui/ink-app/utils/computerUse/` imported `@ant/computer-use-mcp`, absent from package.json/lockfiles/node_modules (audit grade F). Found to have live consumers (`services/mcp/client.ts`, `config.ts:644,1515`, `analytics/metadata.ts:135`, `query.ts:1048,1504`, `stopHooks.ts:168`) — all lazy + `feature('CHICAGO_MCP')`-gated (flag defined nowhere → DCE'd, `@ts-nocheck` + ambient stubs masked the breakage). Chose **adapter, not removal**.

- New `utils/computerUse/engine/`: types/session/tools/server/executor/sentinel backed by `@allternit/computer-use` (`AllternitComputerUseClient`); rewired wrapper/hostAdapter/mcpServer/gates/executor/cleanup/ComputerUseApproval — all typed, no `@ts-nocheck`.
- Deleted native-only input/swift/drainRunLoop/escHotkey loaders + ambient d.ts stubs; added typed `Server.setRequestHandler` overloads to global.d.ts.
- Declared `@allternit/computer-use: workspace:*` in cmd/gizzi-code/package.json; root pnpm-lock.yaml updated; `script/ensure-sdk-dist.sh` builds sdk dist before typecheck; ts-nocheck baseline regenerated (10 computerUse files out).

## Verification
`bun run typecheck` exit 0 (now typechecks for real with stubs gone); `check-ts-nocheck.sh` baseline=2389 current=2389.

## Honest deferrals / incidents
- Engine backend can't do app enumeration, display geometry, region zoom, cursor queries, per-app input gating — throws not-supported/no-ops (enforcement owned by engine/approval layer).
- No tests exist for this subtree; none added (repo convention).
- `bun.lock` intentionally untouched (pnpm is the workspace manager).
