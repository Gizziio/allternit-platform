# 2026-09-18 20:46 — ao/lawlayer-packaging — kimi-code — @allternit/lawlayer packaging fix

## What was done

Fixed the `@allternit/lawlayer` packaging bug surfaced by the runtime-packaging agent (PR #635): two integration compatibility suites import `@allternit/lawlayer`, which failed `ERR_MODULE_NOT_FOUND` — no built dist (dist gitignored, never built).

PR: https://github.com/Gizziio/allternit-platform/pull/637 — merged as `5eb02d25f` (commit `62587834a`, branch `ao/lawlayer-packaging`).

## Root cause (same class as runtime — paths-poisoned rootDir, plus never-built dist, plus dead subpath exports)

1. **Same class as runtime.** `domains/governance/legal-compliance/regulatory-framework/tsconfig.json` mapped `@allternit/governor` to `../../governor/src/index.ts` — a source file outside the package. Paths-resolved files enter the program as sources, so tsc's computed common source directory inflated to the workspace root and any build would have emitted `dist/domains/governance/...` instead of `dist/index.js`. The `@allternit/runtime` entry in the same map was worse than useless: it pointed at `../../3-adapters/allternit-runtime/src/index.ts`, a path that has never existed (dangling).
2. **Never-built dist.** No `prepare` script; with dist gitignored, `main`/`types`/`exports` never existed on fresh checkouts.
3. **Dead subpath exports.** `./policies` and `./engine` in `exports` point at `dist/policies/index.js` / `dist/engine/index.js` with no counterpart in `src` (no `src/policies/`, no `src/engine/index.ts`) and no importers anywhere in the repo.

## The fix

- Removed the `baseUrl` + `paths` block from the lawlayer tsconfig (governor/runtime now resolve via the workspace symlinks to their built dists — both have `prepare` from PR #635).
- Added `"prepare": "npm run build"` (same convention as governor/runtime).
- Removed the two dead subpath exports (`./policies`, `./engine`).
- Updated the exclusion comments in `tests/vitest.config.ts` with the verified reason the two compatibility suites stay excluded.

## Verification evidence

- `pnpm install --frozen-lockfile` → exit 0, `pnpm-lock.yaml` untouched.
- Fresh-state build (`rm -rf dist node_modules/.cache` → `pnpm --filter @allternit/lawlayer build`) → clean; dist layout: `index.js`/`index.d.ts` at dist root + `adapters/`, `engine/policy-engine`, `receipt-generator`, `types` — matching `main`/`types`/`exports`. (Before the fix the package had no dist at all; the tsconfig bug would have emitted `dist/domains/governance/...`.)
- ESM resolution check from repo root: `import.meta.resolve('@allternit/lawlayer')` → `…/regulatory-framework/dist/index.js`; dynamic import yields 11 exports (`LawLayer`, `LawPolicyEngine`, `PolicyTemplates`, `LawReceiptGenerator`, `BeadsAdapter`, `checkPolicy`, `createLawLayer`, `createBeadsAdapter`, `createReceiptGenerator`, `BuiltinAttestationGenerators`, `PolicyPresets`). Package is ESM-only, so the CJS gate form does not apply.
- Suite un-exclusion experiment: with the lawlayer import now loading, all 13 tests in `allternit-runtime-compatibility.test.ts` still fail — `beforeEach` calls `_clearActiveSessions`, a runtime export that has never existed. Stubbing only that helper: 9 pass, 4 fail on semantics — the suites expect a runtime↔lawlayer `delegateTo: 'law-layer'` delegation contract that was never wired (`wrapToolExecution` doesn't consult a LawLayer the test registers policies on; `PluginAdapter.loadPlugin` succeeds without a WIH when the suite expects failure). Orphaned scaffolds, same class as the runtime e2e's `executeTool` — **both compatibility suites stay excluded**, reason documented in `tests/vitest.config.ts`.
- `tests/` vitest full config → 24/24 pass (matches PR #635's green baseline).
- `node scripts/release-preflight.mjs` → **52 passed, 0 failed**.
- `cd cmd/gizzi-code && bash script/ensure-sdk-dist.sh && npx tsc --noEmit` → exit 0.

## Incidents

None. Branch rebased against origin/main before merge (concurrent burn-agent merges had advanced main to `e1521f323`); no conflicts.

## Honest deferrals

- The two compatibility suites and `integration/allternit-e2e.test.ts` remain excluded; making them runnable needs product code (a real runtime↔lawlayer delegation path and a `_clearActiveSessions` test helper or equivalent) — out of scope for a packaging fix.
- Other workspace packages with the same never-built-dist shape were not audited (same deferral as the runtime ledger).
