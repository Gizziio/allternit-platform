# Pilot 3 — React Compiler artifact de-compilation codemod (permissions remainder + components/ root)

> **Session:** ao/artifact-codemod-pilot3 · **Agent:** kimi-code · **Date:** 2026-09-19 0012
> **PR:** #660 merged `b5cdc51463707dab1e9a03e0ca4766d3a9a10c90` (merge commit `668a905db` on branch)
> **Spec:** `docs/programs/gizzi/INK_APP_COMPILER_ARTIFACTS.md` §6.1 · Pilots 1–2: #647, #652

## What was done

Converted **30** React Compiler artifacts from committed compiler output to ordinary,
hand-editable, typechecked TSX, in three commits + a steering checkpoint:

1. `27b958568` — script hardening (`cmd/gizzi-code/script/decompile-artifact.mjs`),
   three systematic patterns pilots 4+ benefit from:
   - **Straight-line fallback** (`straightLined=N`): cache regions whose outputs are
     assigned inside nested control flow (`bbN` labeled blocks, early-return
     sentinels, inner cache guards) cannot flatten into ordered consts. When strict
     validation fails but the skeleton holds (else branch = exactly one `NAME = $[k]`
     replay per declared name; every replayed slot written in the compute branch; no
     hooks inside), the compute (cache-miss) path is kept unconditionally and the
     replay branch dropped. `bbN:`/`break` kept verbatim; nested guards recursively
     straightened; genuinely-`let`-preceded nested memo blocks left for the strict
     inliner. Three safety gates; honest leftover reporting unchanged.
   - **Rest-element destructuring**: `({ ...rest } = t0)` counts the rest binding as
     a result assignment (whole-props guards with a rest were previously skipped).
   - **Duplicate-binding renames** now register destructured const bindings
     (`const { tab: t5 } = t0`) and rename the later-positioned binding
     (position-sorted — a const is never read before its declaration).
2. `a35dd3d0c` — the 30 conversions: `components/permissions/rules/` (8; **entire
   permissions subtree now converted**), the pilot-2-deferred permissions group (5:
   NotebookEdit×2, SedEdit, Skill, WebFetch), components-root message cluster (12,
   highest-traffic first: Message, Messages, MessageRow, MessageModel,
   MessageResponse, MessageSelector, MessageTimestamp + 5 rejected/fallback message
   components), inputs (BaseTextInput, VimTextInput), dialogs (GlobalSearch,
   QuickOpen, CostThreshold). ~285 memo blocks inlined; 3 regions straight-lined by
   the script; zero `$[k]`/`_c`/`compiler-runtime` leftovers; `@ts-nocheck` stripped
   on all 30.
3. `e04a6858f` — bookkeeping regen: `excludedCompilerArtifacts` 301→271 (exactly 30);
   baseline re-locked (see below); 25 DONE batches preserved at that time;
   `totalAccounted` constant 1473; regen deterministic (re-run diff clean).
   + `c9673c9ab` steering checkpoint.

## Type drift fixes (~85 errors, all type-only, zero runtime change)

The original-era sources fail tsc against today's types. Fixed by: restored helper
types (notebook cell/content shape — `types/notebook.ts` is a stub mirroring
`src/runtime/tools/builtins/notebook.ts`; CustomSelect `Option` — `ui/option.ts` is a
stub; RecentDenialsTab denial-state Sets; SedEdit promise chain; PermissionRuleList
state incl. `useState<PermissionRule | undefined>()` etc.); literal-widening locks
(`UnaryEvent`, `PermissionUpdateDestination`, `TextBlockParam`, Select
`OptionWithDescription[]`); boundary casts restoring intent: `RenderableMessage`
(loose interface) → normalized discriminated unions (`asRowMessage` alias in
MessageRow; `PipelineNormalizedMessage` in Messages), `NestedMessage.content`'s new
`| unknown` member (`ContentBlocks` alias), stub-module `require()` shapes
(snipProjection/snipCompact/SendUserFileTool prompt), and un-converted artifact
dependencies (HighlightedCode/StructuredDiff/`useRegisterOverlay` — pilot-2 pattern).

## Verification evidence

- `bash script/ensure-sdk-dist.sh && npx tsc --noEmit`: **exit 0** (0 errors;
  re-verified post-rebase and post-merge-commit).
- `bun run test`: **1329 pass / 0 fail / 42 skip**, SMOKE PASS 111 entries
  (post-rebase and post-merge-commit runs; the one mid-flight failure was the
  nocheck ratchet correctly demanding the baseline re-lock).
- `node scripts/release-preflight.mjs`: **52 passed, 0 failed** (run-only; re-run
  post-rebase).
- `bash script/check-ts-nocheck.sh`: green, baseline=current=1335 (final; see
  incidents for the 1418→1336→1335 path).
- Queue: `excludedCompilerArtifacts` 271 (301−30 exactly); **26 DONE batches
  preserved** (diffed vs origin/main post-merge); `totalAccounted` 1473 constant;
  regen deterministic.
- Grep: zero `react/compiler-runtime` / `_c(` / `$[n]` / `@ts-nocheck` in all 30
  converted files.
- Behavior spot-check (2 highest-traffic): `Messages.tsx` — zero non-mechanical
  removals, identical 27-hook set/order, identical three-tier filter/group
  pipeline; `Message.tsx` — identical 5-way `message.type` dispatch with
  per-branch props; hooks before all switch returns. Plus BaseTextInput (input hot
  path) and the straight-lined MessageSelector `UserMessageOption` (sentinel/`bb0`
  flow verbatim).
- Hook-order hazard review: none — every early return stays behind the hooks it
  already followed; straight-lining gate 3 refuses hook-containing compute
  branches.

## Incidents (honest)

- **Main advanced twice mid-flight** (b0020/b0218/b0219, then b0022 while the PR was
  open). First caught by the DONE-batch diff vs origin/main (3 DONE batches missing
  from a stale-seeded regen); resolved by rebase + regen seeded from main's queue.
  Second produced the expected queue.json merge conflict in the PR; resolved the
  same way (regen from main's queue, all 26 DONE preserved). Baseline path:
  1418 → 1336 (my 30 + concurrent burns' 52) → 1335 (b0022's 1).
- **Dup-rename loop**: first iteration renamed by registration order, producing
  `t5_2_2_2_…`; fixed to position-order and regression-tested byte-identical
  against fresh single-pass transforms of all 30 originals.
- **Escape-level bug in the new straightener** (`\\$` over-escaped in a template
  literal) found by targeted debug harness, not by luck — the safety gates held
  (blocks were left untouched, not mis-transformed).

## Deferred / follow-ups

- Desktop binary rebuild after this merge: **not performed** (same as pilots 1–2;
  the codemod changes gizzi-code source that the desktop bundles at next release
  build — no release is being cut from this session). Flag if a preview binary
  refresh is wanted.
- **271 compiler artifacts remain.** Pilot 4 GO. Next cluster per spec ordering:
  the `components/` subtrees now dominating the remaining set (CustomSelect/,
  PromptInput/, Spinner/, Settings/, tasks/, agents/ wizard, design-system/, …) —
  recommend CustomSelect + PromptInput next (highest fan-in among remaining;
  note `useRegisterOverlay` in `context/overlayContext.tsx` is itself still an
  artifact and would remove two of pilot 3's cast workarounds).
