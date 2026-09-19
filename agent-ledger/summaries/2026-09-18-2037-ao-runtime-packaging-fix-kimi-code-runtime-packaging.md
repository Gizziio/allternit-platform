# 2026-09-18 20:37 — ao/runtime-packaging-fix — kimi-code — @allternit/runtime packaging fix

## What was done

Fixed the `@allternit/runtime` packaging bug diagnosed by PR #631 (receipt-test fix): the package's `tsc` build emitted a `dist/services/runtime/adapter/allternit-runtime/src/...` layout while `package.json` `main`/`exports` point at `./dist/index.js`, so the package was unloadable and three integration suites were excluded as orphaned.

PR: https://github.com/Gizziio/allternit-platform/pull/635 — merged as `5f3fda740` (commit `77cf1d9ef`, branch `ao/runtime-packaging-fix`).

## Root cause (option a — tsconfig rootDir mismatch, induced by paths)

`services/runtime/adapter/allternit-runtime/tsconfig.json` had a `paths` map sending `@allternit/governor` to its **source `.ts` file outside the package** (`../../../../domains/governance/governor/src/index.ts`). `paths`-resolved files enter the program as source files, so tsc computed the common source directory as the workspace root and emitted `dist/services/runtime/adapter/...` + `dist/domains/governance/governor/...`. `@allternit/engine`/`@allternit/orchestrator` also expose `src/index.ts` via their `types` condition, but through node_modules resolution — tsc treats those as library files (not emitted, not counted toward rootDir). Only the `paths`-mapped governor source poisoned the layout.

## The fix

- Removed the `baseUrl` + `paths` block from the runtime tsconfig (governor now resolves via the workspace symlink to its built dist; `@allternit/browser` and self-referential mappings were unused).
- Added `"prepare": "npm run build"` to the runtime package.json (same pattern as `@allternit/governor`) so `dist` is built on fresh `pnpm install` — otherwise the entry points stay missing wherever dist is gitignored.
- Updated the exclusion comments in `tests/vitest.config.ts`. The three runtime suites **stay excluded**, verified reason: `allternit-e2e.test.ts` constructs `AllternitRuntimeBridge` with an option-taking constructor and calls `executeTool` — an API that has never existed (orphaned scaffold, same class as the `@allternit/shell` e2e); the two compatibility suites additionally import `@allternit/lawlayer`, which has no built dist and fails `ERR_MODULE_NOT_FOUND` independent of this fix.

## Verification evidence

- `pnpm --filter @allternit/runtime build` from clean dist → emits `dist/index.js` + `adapters`/`hooks`/`wrappers` subpath entries matching `main`/`types`/`exports`.
- ESM resolution check from repo root: `import.meta.resolve('@allternit/runtime')` → `…/allternit-runtime/dist/index.js`; dynamic import yields 35 exports. (Package is ESM-only — `"import"` condition + `"type": "module"` — so the CJS `require.resolve` gate form does not apply.)
- `pnpm --filter @allternit/runtime test` → 11/11 pass.
- `tests/` vitest full config → 24/24 pass (matches PR #631's green state).
- Un-excluded-suite experiment: `allternit-e2e.test.ts` collects and runs (package loads; failure mode changed from module-not-found to a real assertion) and fails only on the never-implemented `executeTool` API — re-excluded with updated comment.
- `pnpm install --frozen-lockfile` → exit 0, `pnpm-lock.yaml` untouched.
- `node scripts/release-preflight.mjs` → **52 passed, 0 failed**.
- `cd cmd/gizzi-code && bash script/ensure-sdk-dist.sh && npx tsc --noEmit` → exit 0 (runtime types still resolve for checked code).

## Incidents

None. Branch rebased against origin/main before merge; no concurrent burn-agent conflicts (services/runtime is outside the burn zone).

## Honest deferrals

- The three runtime integration suites remain excluded; making them runnable needs product code (a real `executeTool` bridge API) and/or a built `@allternit/lawlayer` — out of scope for a packaging fix.
- `@allternit/lawlayer` (and possibly others) have the same never-built-dist shape; a repo-wide audit of workspace packages whose `main` points at unbuilt dist was not done.

## Final state

- `git-discipline-check.sh`: PASS (pasted in session summary).
