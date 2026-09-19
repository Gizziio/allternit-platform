# Pilot 7 — React Compiler artifact de-compilation: ink components + mcp + plugin + hooks

**Session:** ao/artifact-codemod-pilot7 (worktree `allternit-ao-codemod7`)
**Agent:** kimi-code subagent | **Date:** 2026-09-19
**PR:** #677 (merged, merge SHA `0b11e2c16`)

## What was done

Seventh increment of the ink-app artifact de-compilation codemod
(spec: `docs/programs/gizzi/INK_APP_COMPILER_ARTIFACTS.md`). Converted 33
artifacts — the four largest remaining clusters:

- `ink/components/` (11, vendored ink-rendering core: Box, Text, Button, Link,
  Spacer, Newline, RawAnsi, NoSelect, AlternateScreen, ClockContext,
  TerminalFocusContext)
- `components/mcp/` (9), `commands/plugin/` (8), `components/hooks/` (6,
  incl. PromptDialog)

`decompile-artifact.mjs` needed **no changes** — fifth consecutive pilot at
zero script changes (tool converged). 33/33 transformed, 0 failures, 2
hand-fixes. **148 artifacts remain.**

## Hand-fixes and pattern class

- `MCPListPanel.tsx` / `McpParsingWarnings.tsx`: one orphan cache-write each
  (`$[k] = tN;`) left after a sentinel-only guard block was flattened —
  compute path verbatim, write dropped. Variant of the pilot-5
  loop-mutated-let class (orphan WRITE vs orphan READ); 2 occurrences this
  pilot, 4 total — still below the 3-per-pilot teach threshold, script
  untouched.

## Type recovery (126 drift errors → 0, all type-only, zero headers kept)

The sourcemaps' `sourcesContent` plus the runtime producers recovered types
the TEMPORARY SHIM files never had:

- `components/mcp/types.ts`: `ServerInfo` (base `{name, client:
  MCPServerConnection, scope: ConfigScope}` + transport discriminant),
  `AgentMcpServerInfo` (from `extractAgentMcpServers` field set),
  `MCPViewState` (5-variant discriminated union from MCPSettings).
- `commands/plugin/types.ts`: `ViewState` (10-variant parent-screen union)
  + `PluginSettingsProps` — referenced since the root commit, never existed.
- `entrypoints/sdk/coreTypes.ts`: `HookEvent = (typeof HOOK_EVENTS)[number]`,
  re-exported via `agentSdkTypes.ts`.
- Erased generics restored: `useState<MCPViewState>`, `useState<ModeState>`,
  `PluginSettings(t0: PluginSettingsProps)`.
- `ElicitationDialog.tsx`: type imports moved from the repo-local ambient
  shim `@modelcontextprotocol/sdk/types` (`src/types/missing-modules.d.ts`,
  `requestedSchema` was `unknown`) to the real SDK `@modelcontextprotocol/sdk/types.js`
  — type-only, erased at compile time; cleared both the `unknown` cascade
  and the duplicate-SDK-identity `PrimitiveSchemaDefinition` mismatches.
- `strict: false` quirks: `useRegisterOverlay('…')` given explicit `undefined`
  second arg (callee is an unconverted artifact, optional param has no
  type-level default); two `InstallPluginResult.error` reads pinned via
  failure-branch cast (discriminant narrowing disabled).
- Verbatim-upstream dead `figures.triangleUpOutline/triangleDownSmall/
  triangleRightSmall` (absent from vendored figures@3.2.0 at runtime too)
  pinned with scoped `@ts-expect-error TODO(types)` per pilot 5 precedent.

## Bookkeeping

- Baseline ratchet `--update`: 1001 after rebase (drop = 33 conversions).
- Queue regen (seeded from main's queue, deterministic):
  `excludedCompilerArtifacts` 181 → 148; recorded burns total preserved
  (702 → 702); 27 mid-flight retired-id absorption records (b0369–b0394)
  from concurrent burn agents superseded by the regen (same absorption
  pattern pilot 6 recorded for b0337).
- TWO mid-flight absorbs: main moved 19 commits during the pilot (b0100,
  b0365, b0366, b0099 burn merges); rebased onto latest origin/main
  immediately before push, all gates re-run post-rebase. Rebase `--theirs`
  gotcha (ours/theirs swap) caught by queue-stats sanity check, corrected
  to `--ours` + regen.

## Verification

- `npx tsc --noEmit` (cmd/gizzi-code): 0 errors (multiple runs incl. post-rebase)
- `bun run test`: 1332 pass / 0 fail / 42 skip, SMOKE PASS (post-rebase rerun 0 fail)
- `node scripts/release-preflight.mjs`: 52/0
- `bash script/check-ts-nocheck.sh`: baseline == current (ratchet green); guard 5/5
- Zero `compiler-runtime` / `_c(` / `$[n]` in converted files; esbuild parse 33/33
- Behavior spot-check: Text, Box (column), Button (function-child state path)
  rendered through the local ink runtime to string — all correct
- Hook-order: Button.tsx (straightLined=1) and MCPToolListView.tsx (bb0 labels)
  verified — no hook crosses a conditional return

## Forward

148 artifacts remain in small clusters (sandbox 5, shell 4, Settings 4,
FeedbackSurvey 4, HelpV2 3, BashTool 2, wizard 2, teams 2, plus 1-file
clusters). **Pilot 8 = final full pilot** (converts all remaining), then the
final PR deletes the stub machinery per spec §6.2 (stub module, three
tsconfig paths entries, build-production.js inline stub + redirect,
`src/types/react.d.ts` augmentation) once the §2 grep returns zero.
