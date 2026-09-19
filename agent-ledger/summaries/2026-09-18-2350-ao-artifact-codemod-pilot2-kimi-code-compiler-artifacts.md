# Session attestation — ao/artifact-codemod-pilot2 (React Compiler artifact de-compilation, pilot 2)

- **Date:** 2026-09-18 (late evening local)
- **Agent:** kimi-code (subagent, pilot 2 of the codemod program)
- **PR:** #652 (merged via merge commit `0d187e0ab`)
- **Spec:** `docs/programs/gizzi/INK_APP_COMPILER_ARTIFACTS.md` §6.1 (pilot 1: #647)

## What was done

Second per-subtree codemod PR: de-compiled **30** React Compiler artifacts —
the 7 deferred files of `components/messages/UserToolResultMessage/` plus 23
files of `components/permissions/` (all 11 root files + 12 subdir files, the
~30-file cap per the spec ordering; `permissions/rules/` (7) and
NotebookEdit/SedEdit/Skill/WebFetch (5) deferred to pilot 3).

**Script hardening** (`cmd/gizzi-code/script/decompile-artifact.mjs`, commit
`100728f10`) — three systematic failure modes taught to the script instead of
hand-fixed:

1. JSX-text quotes: quote preceded by a word char/`>` (apostrophes like
   `Gizzi's`) or with no same-line closer is literal text, in all three
   scanner copies (scan, splitStatements, and the new maskNonCode). Before
   this, a JSX apostrophe desynced brace-depth tracking and silently skipped
   memo blocks.
2. Paren-wrapped destructuring assignments `({ a, b } = expr);` in memo-block
   if-branches: destructured names count as result assignments, and names
   assigned only via the destructure keep their `let NAME;` declaration
   (cannot be const). tsc caught the first iteration emitting undeclared
   assignments — fixed before merge.
3. New `dedupeConstDecls()` post-pass: inlining flattens compiler temps that
   legally reused a name across sibling cache regions in the compiled
   nesting, producing duplicate `const t8` (SyntaxError) when flattened.
   Renames the later binding + its reads, skipping legally-shadowed nested
   scopes (10 renames across 4 files). Safe by construction: input files are
   valid JS, so any same-scope duplicate const in the output is
   script-created.

Pilot 1's four named refinements were verified already committed (greedy
let-consumption with retry, `}`-splitting, `===` in conditions, t0→Props
member-name guard) — no re-implementation needed; pilot 2 confirmed them
against new file shapes.

**Conversion** (commit `24dc73f21`): ~470 memo-cache blocks inlined as consts
at first use (evaluation order preserved); 7 blocks honestly hand-fixed (4
early-return-sentinel/`bb0` → early returns/IIFE, 2 mutable-accumulator memo
blocks → unconditional straight-line loops, 1 try/catch straight-lined;
`utils.tsx useGetToolFromMessages` regained its original `useMemo` shape via
the embedded sourcemap's original source). t0→Props rename where the member
guard passed. `@ts-nocheck` removed on all 30; **16 type-drift errors** fixed
type-onlyly (restored state/helper types, UnaryEvent/PermissionPromptOption
annotations, casts for not-yet-converted artifact deps StructuredDiff and
HighlightedCode, local `KeybindingAction = string` for the stubbed
keybindings/types module). No runtime behavior changed.

**Bookkeeping** (commit `840ab1d24`): artifact exclusion 331 → 301 (exactly
30), live nocheck 1446 → 1416, baseline re-locked at 1418 — also absorbing
the 23-header drift from concurrently-merged #651 (dead-code cut), the same
lock-in pattern pilot 1 recorded. All 22 DONE burn batches preserved;
`totalAccounted` constant 1473; regen deterministic (re-run diff clean).

## Verification evidence

- Full `tsc --noEmit` after ensure-sdk-dist: **exit 0** on the final rebased
  tree (16 surfaced drift errors all fixed type-onlyly).
- `bun run test`: **1311 pass / 0 fail**, SMOKE PASS 107 entries.
- `node scripts/release-preflight.mjs`: **52 passed, 0 failed** (run-only;
  release-desktop.yml and desktop/voice/build paths untouched).
- `bash script/check-ts-nocheck.sh`: baseline=1418 current=1418.
- GitHub CI on PR #652: all 8 checks pass (typecheck 2m22s, smoke 2m16s,
  ratchet, audits, scans).
- Queue regen: DONE batch IDs diffed vs origin/main — 22/22 preserved.
- Grep: zero `react/compiler-runtime` / `_c(` / `$[n]` / `@ts-nocheck` in
  the 30 converted files.
- Behavior spot-check (2 highest-traffic): `PermissionPrompt` — identical
  hook set/order, identical Select dispatch props, keybinding handlers
  semantically unchanged; `UserToolResultMessage` — identical 4-way dispatch
  chain and per-branch props, sole hook before all returns.

## Incidents

- #651 (ix dead-code cut) merged mid-flight; rebase clean, bookkeeping
  regenerated post-rebase with DONE diffed vs origin (no drops — the seeded
  regen discipline from pilot 1 was applied preemptively).
- One self-caught script bug (undeclared destructure names) found by tsc on
  the first full typecheck; fixed in the script and the two affected files
  regenerated from git — caught before any commit.

## Honest deferrals

- `permissions/rules/` (7 artifacts) + NotebookEdit/SedEdit/Skill/WebFetch
  (5) await pilot 3 (~301 artifacts remain repo-wide).
- StructuredDiff.tsx and HighlightedCode.tsx (the two casts in
  FileWriteToolDiff) are still artifacts; their conversion removes the cast.
- `usePermissionExplainerUI(props)` in PermissionExplanation keeps an
  untyped param (no in-file Props type for the guard to use) — typed when a
  later pilot touches it or via the burn queue.
