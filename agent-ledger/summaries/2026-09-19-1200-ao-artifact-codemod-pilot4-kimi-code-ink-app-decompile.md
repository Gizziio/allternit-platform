# Pilot 4 — React Compiler artifact de-compilation: design-system + tasks + components root

**Session:** ao/artifact-codemod-pilot4 (worktree `allternit-ao-codemod4`)
**Agent:** kimi-code subagent | **Date:** 2026-09-19
**PR:** #662 (merged, merge SHA `b7cd808b6f042971e9189c26387fcd4eb27e76d8`)

## What was done

Fourth increment of the ink-app artifact de-compilation codemod
(spec: `docs/programs/gizzi/INK_APP_COMPILER_ARTIFACTS.md`). Converted 30
artifacts under `cmd/gizzi-code/src/cli/ui/ink-app/components/`:

- `components/design-system/` (15), `components/tasks/` (10), components
  root (5: App, Markdown, Spinner, TaskListV2, VirtualMessageList).
- The pilot brief's "pilot 3 deferred permissions files" were verified
  already landed in pilot 3's commit `a35dd3d0c` — scope moved to the next
  clusters instead.

`decompile-artifact.mjs` needed **no changes**: 30/30 transformed clean, 0
script-level hand-fixes; the pilot-3 straight-line fallback handled the 3
sentinel-bearing files (Byline, BackgroundTask, DreamDetailDialog).

## How it works / notable decisions

- **Type drift was the real work this pilot** (all type-only fixes):
  - `types/utils.ts` (b0001 stub) had dropped `DeepImmutable` while 8
    converted tasks files still import it — restored the root-commit
    definition, function-preserving (the verbatim mapped-type-only form
    breaks `WorkspaceTab.tsx`, which calls DeepImmutable-wrapped fns).
  - `ThemeProvider.useTheme()` needed its explicit tuple return type
    (recovered from the artifact's own sourcemap; without it, the memo-stub
    `any`-masking disappears and ~12 downstream files fail tsc).
  - Boundary casts for stub-shaped / un-converted neighbors:
    `watchSystemTheme` (1-arg stub, 2-arg call), `SDKMessage` (no longer
    exported from the `agentSdkTypes` stub), un-converted artifact `Ansi`,
    `useRegisterOverlay` (2 inferred params), `NavigableType`, teammates
    map values.
  - `RemoteSessionDetailDialog`: `toolUseContext` is now passed to
    `UltraplanSessionDetail`/`ReviewSessionDetail` — both declare it
    required but never use it (root-commit inconsistency); passing the real
    value is runtime-invisible.
  - **Kept `@ts-nocheck` + `TODO(types)`** (spec §6.1 rule 5) on:
    - `Spinner.tsx` — TTFT block references `apiMetricsRef` /
      `computeTtftText`, removed upstream while leaving a constant-false
      dead call site (`"external" === 'ant'`). Kept verbatim per rule 6.
    - `BackgroundTask.tsx` — handles `local_workflow` / `monitor_mcp`
      variants whose state types don't exist in this tree.
  - Both entered the burn queue as ordinary entries per §7.
- **Process discovery for future pilots:** the shared checkout's
  `incremental: true` tsbuildinfo masks errors — a "clean" baseline tsc
  there skipped unchanged files. Fresh-worktree full tsc is the honest
  check. Main pre-existing errors: 2 files (cliHighlight, proxy) resolve
  after `pnpm install`; with deps installed tsc is fully clean.

## Verification evidence

- `ensure-sdk-dist.sh && npx tsc --noEmit` → exit 0 (pre- and post-rebase).
- esbuild parse 31/31 (30 files + types/utils.ts).
- `bun run test` (ci-smoke-test): 1329 pass / 0 fail / 42 skip, both runs.
- `node scripts/release-preflight.mjs` → 52/0 (run only, as required).
- `check-ts-nocheck.sh` ratchet green; baseline re-locked at **1290**
  (absorbs concurrent burn batch b0255 merged mid-flight; queue.json
  conflict resolved by re-seeding regen from origin/main's queue).
- Queue regen: excludedCompilerArtifacts 271 → 241 (exactly 30); 26/26
  DONE batches preserved; re-run diff clean (deterministic).
- Zero `react/compiler-runtime` / `_c(` / `$[n]` in converted files.
- Hook-order: straight-lined files hand-verified (2 hookless, 1 order
  preserved; script gate 3 refused hook-bearing branches as designed).
- Behavior spot-check (headless ink render, fake stdout, NODE_ENV=test):
  Byline, ProgressBar, KeyboardShortcutHint render **byte-identical** vs
  pre-conversion; Markdown and Dialog fail identically on main and branch
  (environmental: missing AppState context / raw-mode stdin).

## Incidents / honest deferrals

- Rebase conflict on `queue.json` with concurrent burn batch b0255 —
  resolved by taking main's queue and re-running the deterministic regen;
  DONE set verified identical (26/26) before committing.
- 2 of 30 files (Spinner, BackgroundTask) keep `@ts-nocheck` — documented
  above; they are burn-queue entries now, not silent skips.
- Remaining artifacts: **241**. Next coherent clusters: `components/agents/`
  (18), `components/PromptInput/` (10), `components/mcp/` (8),
  `components/Spinner/` (6), then `components/CustomSelect/` + `diff/` +
  `HelpV2/` to finish `components/`.

## GO/NO-GO for pilot 5

**GO.** Script unchanged for a second consecutive pilot at 0 hand-fixes;
straight-line fallback is carrying the sentinel pattern class. Pilot 5
should take `components/agents/` (18) + `components/Spinner/` (6) +
`components/CustomSelect/` (4) ≈ 28 files. Watch for: ink/ subtree files
(Ansi etc.) as stub-boundary cast sources — converting `ink/` early would
remove several cast sites; and use the fresh-worktree tsc, not the shared
checkout's incremental one.
