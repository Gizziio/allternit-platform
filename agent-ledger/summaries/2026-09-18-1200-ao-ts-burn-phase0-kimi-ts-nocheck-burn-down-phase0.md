# Session ao/ts-burn-phase0 — @ts-nocheck burn-down Phase 0 infrastructure

**Date:** 2026-09-18
**Agent:** Kimi Code (subagent of the main orchestrating session)
**PR:** #583 (merged, merge SHA 9d4e038a48d9c991a7975753c0886e56f814eaeb)
**Branch:** ao/ts-burn-phase0 (deleted after merge)

## What was done

Phase 0 infrastructure for the cmd/gizzi-code TypeScript @ts-nocheck burn-down, in one PR with three logical commits:

1. **fix(gizzi-code): ensure-sdk-dist.sh builds @allternit/os-contracts dist** — `cmd/gizzi-code/script/ensure-sdk-dist.sh` gained a third build block (same missing-or-stale sentinel contract as the existing packages/sdk and sdk/computer-use blocks). Fresh worktrees previously failed typecheck with 3x TS2307 (`Cannot find module '@allternit/os-contracts'`) until someone manually built that package; every burn-down lane would have hit this.

2. **feat(gizzi-code): burn-down queue builder + generated queue.json** — new zero-dependency `cmd/gizzi-code/script/typecheck-burndown/build-queue.mjs`: enumerates handwritten nocheck files (excludes React Compiler artifacts by fingerprint `react/compiler-runtime` / `c as _c` / `$[0]`, and vendored `ink-app/ink/` + `ink-app/vim/` subtrees, both as named constants); resolves imports per tsconfig paths priority (ink-app shadows runtime on the specialized `@/<stratum>/*` prefixes; longest-prefix match; extension/index/.js→.ts expansion); leaf-first topological order (fewest transitive intra-queue dependencies first, twin pairs adjacent runtime-before-ink-app, ties by LOC); packs batches at 5,000–7,000 LOC (7,500 hard cap; single files >1,500 LOC get dedicated batches; twins never split). Deterministic output (stable sorts, no timestamps).

3. **test(gizzi-code): ts-nocheck regression guard** — `cmd/gizzi-code/test/ts-nocheck-guard.test.ts` (bun test, mirrors dead-code-guard style), added to `test/smoke.txt`: asserts the handwritten nocheck count never grows vs the committed queue.json baseline (scan rules imported from the builder so guard and generator cannot drift), with explicit allowlist escape hatch `test/ts-nocheck-allowlist.txt`; and asserts every file listed in queue.json still carries the header (burn-down without queue-state update fails loudly).

Also: one-paragraph doc update to `cmd/gizzi-code/AGENTS.md` Build section (the only doc referencing ensure-sdk-dist).

## Queue numbers (generated 2026-09-18 from 3a2ab23a6)

- Total `// @ts-nocheck` files in src/: **2,235**
- Excluded: **361** React Compiler artifacts + **93** vendored ink/vim → **1,781** handwritten queue files, **522,165 LOC**
- **108 batches**: 55 solo-large-file (>1,500 LOC), 53 group batches (median 7,120 LOC, min 1,633 tail, max 7,484); 42 twin pairs paired
- Strata shape: leaf-most batches dominated by utils/hooks + leaf utils; commands/components concentrated in late batches (b0103+). Batches are dependency-ranked, so most are strata-mixed by design.
- Probe deltas vs the 2026-09-18 prior probe: artifacts 361 vs ~363, vendored 93 vs ~94, queue 1,781 vs ~1,780 — fingerprint-boundary noise on a handful of files; the script reports its own measured constants and the guard pins them as the baseline.

## Verification evidence

- **Fresh-worktree typecheck green**: wiped `packages/sdk/dist`, `sdk/computer-use/dist`, `packages/@allternit/os-contracts/dist`, then `bash script/ensure-sdk-dist.sh && NODE_OPTIONS=--max-old-space-size=8192 tsc --noEmit` → exit 0. Before the fix (fresh worktree, os-contracts dist absent): exactly 3 errors, all TS2307 on `@allternit/os-contracts` (journal.ts:22, transport.ts:32, transport.ts:47).
- **Smoke suite**: `bun run test` in cmd/gizzi-code → 1309 pass / 0 fail / 42 skip, `SMOKE PASS: 107 entries green` (106 prior + the new guard).
- **Release preflight**: `node scripts/release-preflight.mjs` from repo root → `52 passed, 0 failed`.
- **Determinism**: re-ran build-queue.mjs → queue.json byte-identical to committed.
- No desktop-path files touched; no tags/deploys.

## Incidents / honest deferrals

- **CommRails DAG not used**: the repo AGENTS.md asks >2-step sessions to plan in the CommRails WIH DAG. The orchestrating session's task brief defined a fixed hook-enforced process that did not include DAG planning, so it was not done; flagged here for the record.
- **`.steering/checkpoint.md` not updated** — left untouched to avoid cross-session churn in the PR.
- **desktop binary rebuild (lifecycle step 8)**: skipped legitimately — the change does not touch anything the desktop bundles (script + test + docs only, all inside cmd/gizzi-code; preflight 52/0 confirms release path intact).
- The guard's baseline asserts will need their first real exercise when batch b0001 is burned: the burned files must be removed from queue.json (or the batch marked) in the same PR that removes their headers.
