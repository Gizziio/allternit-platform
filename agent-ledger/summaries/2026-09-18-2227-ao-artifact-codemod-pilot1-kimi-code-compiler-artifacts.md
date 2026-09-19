# Session attestation — ao/artifact-codemod-pilot1 (React Compiler artifact de-compilation, pilot 1)

- **Date:** 2026-09-18 22:27 local
- **Agent:** kimi-code (subagent, pilot 1 of the codemod program)
- **PR:** #647 (merged via merge commit `8feb30f98`)
- **Spec:** `docs/programs/gizzi/INK_APP_COMPILER_ARTIFACTS.md` (landed PR #611)

## What was done

First per-subtree codemod PR under the adopted-as-source plan: de-compiled the 29
root `.tsx` React Compiler artifacts of
`cmd/gizzi-code/src/cli/ui/ink-app/components/messages/` (subtree has 36; the
`UserToolResultMessage/` subdir, 7 files, deferred to a follow-up pilot).

- `cmd/gizzi-code/script/decompile-artifact.mjs` — new zero-dep Node codemod,
  kept for reuse by pilots 2+. Verifies the fingerprint; removes the
  compiler-runtime import, `_c(N)` allocation, and the ANT-ONLY biome marker;
  rewrites memo-cache if/else blocks to plain consts at first use (evaluation
  order preserved); renames `t0` params to Props destructuring with a
  member-name guard; strips stale inline sourcemaps; flags leftover `$[k]`.
- 302 memo-cache blocks inlined by the script; 9 blocks hand-fixed (8
  early-return-sentinel/`bb0` blocks → straight-line/IIFE, 1 vestigial
  cache-write from a pre-existing hand patch removed). Embedded sourcemap
  `sourcesContent` used read-only as a control-flow reference for hand-fixes.
- `@ts-nocheck` removed on all 29 files. 26 surfaced errors were pre-existing
  type drift (the original handwritten sources also fail tsc today); fixed
  type-onlyly (casts, restored inline helper types, `HookEvent` re-derived
  from `HOOK_EVENTS`, `declare const` for a dead-branch constant). No runtime
  behavior changed; hook-order hazard review: none found.
- Bookkeeping per spec §7: `ts-nocheck-baseline.txt` and
  `typecheck-burndown/queue.json` regenerated — artifact exclusion count
  360 → 331, all 21 DONE batch records preserved at final regen, deterministic
  re-runs. Also locked in a pre-existing baseline drift (burn batches b0102/
  b0141/b0142 had lowered the live count without updating the baseline).

## Verification evidence

- `bun run typecheck` (full `tsc --noEmit`, 8 GB) — exit 0 on the final rebased tree.
- `bun run test` (ci-smoke-test.sh) — 1311 pass / 0 fail, SMOKE PASS 107 entries.
- `node scripts/release-preflight.mjs` — 52 passed, 0 failed.
- `bash script/check-ts-nocheck.sh` — baseline=1471 current=1471 (CI ratchet job green).
- Queue regen re-run diff clean (deterministic); grep: zero `react/compiler-runtime` /
  `_c(` / `$[n]` / `@ts-nocheck` (in the 29 files) in the converted subtree.
- Behavior spot-check: `UserTextMessage` and `AssistantTextMessage` before/after
  read-through — identical dispatch logic, JSX, props; the single hook stays
  before all conditional returns.
- GitHub CI on PR #647: all 8 checks pass (typecheck, smoke, ratchet, audit, scans).

## Incidents

- Two mid-flight collisions with the concurrent burn batch agent (b0102/b0141
  then b0142 merged while this PR was open), both exactly the predicted
  `queue.json` conflict; resolved both times by rebase + regen seeded from the
  new main's queue (the fixed builder preserved DONE history once fed the
  previous queue).
- First regen attempt silently dropped two DONE records because the rebase
  conflict resolution left the builder reading a queue without them; caught by
  diffing batch IDs vs origin/main, fixed by seeding regen from
  `git show origin/main:...queue.json`.

## Honest deferrals

- 3 non-sentinel `bb0:` labeled blocks remain (RateLimitMessage,
  SystemTextMessage, AdvisorMessage) — valid TS, convertible to IIFEs later.
- 3 lazy-`require()` sites in UserTextMessage destructure names the lazy
  modules don't export (latent in the artifact, runtime-gated) — cast, not fixed.
- `UserToolResultMessage/` (7 artifacts) and ~331 remaining artifacts await pilots 2+.
- Root eslint now lints the 29 converted files (dynamic ignore keying on the
  fingerprint); no CI lint gate exists, but a future pilot may want an eslint pass.
