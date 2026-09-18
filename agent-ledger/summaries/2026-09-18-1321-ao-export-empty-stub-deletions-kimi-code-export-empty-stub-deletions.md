# 2026-09-18-1321 ao/export-empty-stub-deletions (kimi-code, agent-57)

## What was done

Verified deletion of 4 confirmed-DEAD `export {}` stub files from the gizzi-code
reachability sweep (46 candidates triaged read-only; these 4 had zero importers of
any kind, re-verified twice including `.js`-remapped require evidence). Worked in a
fresh worktree `allternit-ao-exportdel` on branch `ao/export-empty-stub-deletions`
off origin/main @ d16f7fff4.

Deleted (PR #608, merged 499e2156c):

1. `cmd/gizzi-code/src/runtime/tools/utils/permissions/autoModeState.ts` — 2-line
   shim. Every live `autoModeState` importer (`claude.ts` x2 copies, `permissions.ts`
   x2, `permissionSetup.ts` x2, `attachments.ts` x2, ExitPlanMode twins,
   PromptInput.tsx) resolves to `src/shared/utils/permissions/` or
   `src/cli/ui/ink-app/utils/permissions/` twins. Stem grep + path-fragment grep:
   zero references to the `runtime/tools/utils/permissions` location.
2. `cmd/gizzi-code/src/runtime/tools/utils/permissions/permissionSetup.ts` — same
   pattern; all importers use shared/ and ink-app/ copies. Now-empty `permissions/`
   dir removed (git rm prunes empty parents).
3. `cmd/gizzi-code/src/shared/tools/WorkflowTool/constants.ts` — sole file in the
   dir (ink-app WorkflowTool twins already deleted by PR #594). Repo-wide
   `WorkflowTool` grep: zero hits. Dir removed.
4. `cmd/gizzi-code/packages/sdk/src/providers/allternit/resources/top-level.ts` —
   3-line Stainless-header stub. Codegen check: `packages/sdk/js/script/build.ts`
   has OUTPUT_DIR = `packages/sdk/dist/gen` and never writes into `src/providers/`;
   its only `top-level` mentions are sessionID-conversion code comments. One-time
   generated artifact (last touched by branding commit 2213f8d88), NOT re-emitted on
   sdk build → safe to delete. Not re-exported by resources/index.ts.

Collateral: appended all 4 paths to `cmd/gizzi-code/test/deleted-paths.txt`
(format: repo-relative to cmd/gizzi-code, one per line, trailing LF; first
`packages/` entry — harmless, and the guard's on-disk test now catches any
resurrection of top-level.ts).

## Verification evidence

- Re-verification before delete: static import grep, dynamic import/require grep,
  `.js`-remapped require grep, stem-level grep, path-fragment grep — zero importers
  for all 4 files (full evidence in PR #608 body).
- `bash script/ensure-sdk-dist.sh` — exit 0 (rebuilt sdk/computer-use and
  platform/packages/os-contracts dists in fresh worktree).
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` — exit 0.
- `bun run test` smoke — 1311 pass / 42 skip / 0 fail, 107 files, incl. dead-code-guard.
- `bun test test/dead-code-guard.test.ts` — 4/4 pass (incl. both DYNAMIC_RE-relevant
  checks: no deleted path on disk, no import in src/test/script resolves to a
  deleted path).
- `node scripts/release-preflight.mjs` — 52 passed, 0 failed.
- Shared checkout pulled --ff-only to 499e2156c on first attempt.

## Incidents / deferrals

- None. No escalations, no latent-runtime-bug findings.
- Desktop rebuild (lifecycle step 8) N/A — nothing the desktop bundles changed
  (two src/ stubs were never bundled; sdk change is a src/ stub with no dist
  consumer).
