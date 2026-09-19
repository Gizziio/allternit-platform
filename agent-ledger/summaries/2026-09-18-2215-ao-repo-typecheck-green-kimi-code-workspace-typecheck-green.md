# ao/repo-typecheck-green — workspace-wide typecheck green on fresh install

- **Session:** ao/repo-typecheck-green (worktree `allternit-ao-typecheck`)
- **Agent:** kimi-code (subagent, agent-105)
- **Date:** 2026-09-18 22:15
- **PR:** #644, merged `a32431476` (merge commit), head `ad124fa1f`

## What was done

Root repo-wide `pnpm -r typecheck` had pre-existing failures deferred by earlier agents. Enumerated the full failure set in a **fresh worktree** (`git worktree add` from origin/main, only `pnpm install`) using `pnpm -r --no-bail run typecheck`: **3 fails / 68 passes**. The two known failures were NOT the whole story — `replies-reducer` failed with the same root cause as `provider-adapters` but was never enumerated.

## Failures and fixes (all config/scripts, zero source changes)

| Package | Errors | Root cause | Fix |
|---|---|---|---|
| `platform/packages/provider-adapters` | TS6305 x3 | Composite project reference to `../replies-contract`; its `dist/` is gitignored and unbuilt in a fresh tree, so `tsc --noEmit` redirects the import to an unbuilt declaration output | `typecheck`/`build`: `tsc --noEmit`/`tsc` → `tsc -b` |
| `platform/packages/replies-reducer` | TS6305 + TS7006 | Same composite-reference root cause; unresolved contract types cascaded into implicit-any params | Same: → `tsc -b` |
| `platform/packages/office-slides-editor` | TS2550, TS7006 | `lib: ES2020` while imported `office-pptx-engine` sources use `String.prototype.replaceAll` (es2021+); engine's own tsconfig already ES2022 | `lib` → `ES2022` |

`tsc -b` chosen over alternatives because: (a) it is the canonical composite-project mechanism (build mode builds referenced projects first), (b) prior art — 10+ workspace packages already use `tsc -b` for typecheck, (c) it requires no manual build steps and no emit-ordering assumptions. Rejected alternatives: `tsc -b --noEmit` (TS6310 — referenced composite project may not disable emit), `paths` mapping (TS6305 redirect is driven by project-reference membership, not the resolution path), dropping composite/reference (breaks `declaration`+`rootDir` build emit).

## Verification evidence

All in the fresh worktree with every gitignored `dist/` + `tsconfig.tsbuildinfo` removed first:

- `pnpm -r --no-bail run typecheck` → exit 0 (all packages)
- `pnpm -r run typecheck` (canonical bail mode) → exit 0
- `provider-adapters` / `replies-reducer`: `pnpm build` and `pnpm test` (vitest) green **with `replies-contract/dist` deleted first** (proves `tsc -b` self-heals the reference from a truly fresh state)
- `office-slides-editor`: `pnpm run typecheck` green
- gizzi-code oracle: `cd cmd/gizzi-code && bash script/ensure-sdk-dist.sh && npx tsc --noEmit` → exit 0 (no files gizzi-code consumes were touched — verified it does not depend on any changed package)
- `node scripts/release-preflight.mjs` → **52 passed, 0 failed** (no release-path files touched)
- Re-ran full repo-wide typecheck on the rebased HEAD (over burn-next's b0102, `0f7c246aa`) → exit 0, no overlap conflicts

## Incidents / notes

- Rebased once over the concurrent burn-next agent's PR #643 (gizzi-code-only changes, zero file overlap).
- `packages/@allternit/*` top-level dirs are stale build output from an older layout, not workspace members — ignored.
- The main checkout's `platform/packages/replies-contract/dist` got built during diagnosis (`tsc -b` side effect); dist is gitignored and reproducible — no repo pollution.

## Honest deferrals

None. The fresh-worktree acceptance gate (repo-wide typecheck exit 0 after only `pnpm install`) passes at merge SHA `a32431476`.
