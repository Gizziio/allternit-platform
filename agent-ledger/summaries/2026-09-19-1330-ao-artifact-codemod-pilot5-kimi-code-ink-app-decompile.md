# Pilot 5 — React Compiler artifact de-compilation: agents + Spinner + CustomSelect + diff

**Session:** ao/artifact-codemod-pilot5 (worktree `allternit-ao-codemod5`)
**Agent:** kimi-code subagent | **Date:** 2026-09-19
**PR:** #666 (merged, merge SHA `0ffd36e5373c360264341faab9cb17357e211138`)

## What was done

Fifth increment of the ink-app artifact de-compilation codemod
(spec: `docs/programs/gizzi/INK_APP_COMPILER_ARTIFACTS.md`). Converted 31
artifacts under `cmd/gizzi-code/src/cli/ui/ink-app/components/`:

- `components/agents/` (18, incl. new-agent-creation wizard + 10 wizard steps),
  `components/Spinner/` (6), `components/CustomSelect/` (4), `components/diff/` (3).

`decompile-artifact.mjs` needed **no changes** — third consecutive pilot at
zero script changes. 30/31 transformed clean; 1 hand-fix (below).

## How it works / notable decisions

- **Hand-fix:** `GlimmerMessage.tsx` — one memo-cache block over loop-mutated
  `let`s survived as 22 leftover `$[k]` reads (neither flattening nor the
  straight-line fallback caught this shape); hand-straight-lined by dropping
  the cache guard and slot writes, loop body kept verbatim. New pattern class
  for future pilots: outputs assigned inside a `for` loop body.
- **Type recovery via sourcemaps:** the artifacts' `sourcesContent` carried the
  full pre-compilation sources. Used to restore `AgentWizardData` and
  `SpinnerMode` (both TEMPORARY SHIM `types.ts` files never had them), dropped
  `useState<ModeState>` / `useState<ResolvedAgent | null>` / `SelectInputOption<T>`
  generics, and `wizard/types.ts` `updateWizardData` signature (the real
  WizardProvider artifact takes one updates object; the shim claimed
  `(key, value)` — 9 TS2554s across 10 files).
- `SpinnerMode` union: `'requesting' | 'responding' | 'thinking' | 'tool-use' |
  'tool-input'` — the last member only evidenced by the SpinnerModeGlyph switch.
- **Zero `@ts-nocheck` kept this pilot.** The one verbatim-upstream dead
  comparison (`"external" === 'ant'` in ToolSelector, present in the
  pre-compilation source) is suppressed with a scoped `@ts-expect-error
  TODO(types)` — better than restoring a full header. Beware: TODO comments
  must not contain the literal `@ts-nocheck` string (the ratchet greps
  substrings — false-positive cost a re-run).
- Boundary casts for still-artifact neighbors: typed alias for `StructuredDiff`
  in DiffDetailView, explicit `undefined` second arg to `useRegisterOverlay`,
  default param restored on `renderBuiltInAgentsSection`.

## Verification evidence

- `ensure-sdk-dist.sh && npx tsc --noEmit` → exit 0 (after each rebase/merge).
- esbuild parse 31/31.
- `bun run test` (ci-smoke): **1371 pass / 0 fail / 42 skip** (post-rebase).
- `node scripts/release-preflight.mjs` → **52/0** (run only).
- `check-ts-nocheck.sh` ratchet green; baseline **1290 → 1210** (−31 pilot 5,
  −49 absorbed from burn batches b0256 + b0026 merged mid-flight; re-locked
  once at final merge).
- Queue regen (seeded from origin/main's queue at each absorb):
  `excludedCompilerArtifacts` 241 → **210** (exactly 31); DONE batches
  preserved both times (28/28, then 29/29 vs newer main); re-run diff clean.
- Zero `react/compiler-runtime` / `_c(` / `$[n]` in converted files.
- Hook order hand-verified in all 7 straight-lined files; `useDeclaredCursor`
  confirmed inside nested `TwoColumnRow` (not the main Select body).
- Behavior spot-check (headless ink render, fake stdout, NODE_ENV=test):
  **GlimmerMessage and Select render byte-identical** vs their
  pre-conversion artifact copies (originals recovered from git).

## Incidents / honest deferrals

- Two mid-flight absorbs: burn batches b0256 and b0026 each merged between
  rebase and PR merge; queue.json conflict resolved by taking main's queue +
  deterministic regen both times; DONE sets verified identical before commit.
- `AgentDetail.tsx`'s own sourcemap has corrupt `sourcesContent` (garbage
  bytes) — noted for future pilots; the file converted clean and had zero
  type errors, so nothing was lost this round.
- Remaining artifacts: **210**. Next coherent clusters: `ink/components/` (11),
  `components/PromptInput/` (10), `commands/install-github-app/` (10),
  `hooks/notifs/` (9), `components/mcp/` (8), `commands/plugin/` (8).

## GO/NO-GO for pilot 6

**GO.** Script unchanged for a third consecutive pilot (single hand-fix of a
new pattern class: loop-mutated lets in a cache block — candidates for a
script hardening only if it recurs). Pilot 6 should take `ink/components/`
(11) + `components/PromptInput/` (10) + `components/mcp/` (8) ≈ 29 files.
Watch for: the corrupt sourcemap in AgentDetail (recover types from git
history instead) and PromptInput's likely context dependencies.
