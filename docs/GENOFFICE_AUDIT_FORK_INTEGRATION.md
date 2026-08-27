---
status: done
findings_count: 5
risk_level: medium
---

# GenOffice → Allternit Fork Integration Audit

**Scope:** Four forked GenOffice engine packages + the new `services/office-engine` prototype.  
**Repo:** `/Users/joe/Desktop/allternit-workspace/allternit`  
**Audit date:** 2026-08-04  
**Auditor:** Kimi Code CLI (read-only pass)

## Executive Summary

The forked packages (`@allternit/office-docx-engine`, `@allternit/office-pptx-engine`, `@allternit/office-pptx-render`, `@allternit/office-file-parse`) were successfully rebranded from `@genspark/*` to `@allternit/*`, adapted to the Allternit tsconfig conventions (`moduleResolution: bundler`, `esModuleInterop`), and wired into the pnpm workspace. Individual `typecheck` and `test` scripts pass for all four packages, and the `office-engine` service typechecks and starts correctly.

However, the integration is still **prototype-grade** and carries several production/CI risks that should be fixed before broader adoption. The highest-impact items are: (1) the root `package.json` `pnpm` field is silently ignored by pnpm 10, so declared overrides/patches are not enforced on fresh lockfile generation; (2) the forked packages ship raw `.ts` source files with no build step, which will break consumers that are not tsx/Vite-based; (3) the new service has zero tests, no production build, and no deployment manifest; (4) GenOffice Apache-2.0 attribution is missing from the packages and from `THIRD_PARTY_NOTICES.md`; and (5) there is a significant Vitest/Vite version schism between the engine packages (Vitest 4.x / Vite 8.x) and the rest of the monorepo (Vitest 1.x / Vite 5.x).

| Package | Version | Tests | Typecheck | Build script | Notes |
|---|---|---|---|---|---|
| `@allternit/office-docx-engine` | 0.1.0 | 52 files, 428 passed | ✅ | ❌ | Exports raw `.ts` |
| `@allternit/office-pptx-engine` | 0.1.0 | 57 files, 520 passed | ✅ | ❌ | Exports raw `.ts` |
| `@allternit/office-pptx-render` | 0.1.0 | 8 files, 123 passed | ✅ | ❌ | Exports raw `.ts` |
| `@allternit/office-file-parse` | 0.1.0 | 3 files, 21 passed | ✅ | ❌ | Exports raw `.ts` |
| `@allternit/office-engine-service` | 0.1.0 | 0 files | ✅ | ❌ | Prototype only |

## 1. Package structure and entry points

All four engine packages live under `packages/@allternit/office-*` and are matched by the workspace globs in `pnpm-workspace.yaml` (`packages/@allternit/*`). Each package:

* is `type: "module"` and `private: true`;
* declares a single `exports` map pointing at `src/index.ts` (pptx-engine also exposes `./table-grid` and `./background-promote` subpaths);
* uses `workspace:*` for internal dependencies (`office-pptx-render` → `office-pptx-engine`, `office-file-parse` → `office-docx-engine`);
* has its own `tsconfig.json` with `moduleResolution: "bundler"`, `esModuleInterop: true`, `isolatedModules: true`, and `noEmit: true`;
* has its own `vitest.config.ts`.

The service at `services/office-engine`:

* depends on `@allternit/office-docx-engine` and `@allternit/office-file-parse` via `workspace:*`;
* uses Hono 4.x and `@hono/node-server` 1.x;
* exposes `/health`, `/parse`, and `/docx/roundtrip`;
* starts with `tsx src/index.ts` (dev only).

## 2. pnpm integration findings

### 2.1 Root `package.json` `pnpm` field is ignored by pnpm 10

Root `package.json` still contains:

```json
"pnpm": {
  "overrides": {
    "@types/react": "^18.3.28",
    "@types/react-dom": "^18.3.1",
    "@reduxjs/toolkit": "^2.2.7",
    "react-redux": "^9.1.2",
    "redux": "^5.0.1"
  },
  "patchedDependencies": {
    "follow-redirects@1.15.11": "patches/follow-redirects@1.15.11.patch"
  }
}
```

Running any pnpm command emits:

```
[WARN] The "pnpm" field in package.json is no longer read by pnpm. The following keys were ignored: "pnpm.overrides", "pnpm.patchedDependencies". See https://pnpm.io/settings for the new home of each setting.
```

`pnpm-workspace.yaml` already duplicates `patchedDependencies`, but the **overrides are not duplicated**. If `pnpm-lock.yaml` is ever deleted/regenerated, React/Redux-related versions across the monorepo will float unchecked, which can re-introduce the type conflicts the overrides were meant to prevent.

### 2.2 Workspace globs cover the new packages

`pnpm-workspace.yaml` includes:

```yaml
- 'packages/*'
- 'packages/@allternit/*'
```

This correctly picks up `packages/@allternit/office-*`. Exclusions (`!services/open-connector`, `!services/docmost`, `!cmd/*/sdks`) do not affect the office packages.

### 2.3 Dependency conflicts and peer warnings

The engine packages use **Vitest 4.1.8** and pull in **Vite 8.0.12**, while the root monorepo declares **Vitest 1.0.0** and ends up with **Vitest 1.6.1 / Vite 5.4.21**. The lockfile therefore contains multiple Vitest/Vite instances. This is currently working because each package uses its own local `vitest` binary, but it:

* inflates install size and lockfile churn;
* creates a coverage-v8 peer mismatch (`@vitest/coverage-v8@1.6.1` is a peer of Vitest 4 in some workspaces, producing `unmet peer @vitest/coverage-v8@4.1.8` warnings);
* makes root-level `vitest` commands (e.g. `pnpm test`) incompatible with package-level configs.

Other peer warnings observed are not specific to the GenOffice integration (e.g. TipTap, React 19, electron-builder, better-auth), but the Vitest schism is directly caused by the new packages.

### 2.4 Native dependency concerns

`office-file-parse` depends on `pdfjs-dist@^5.4.54`, which resolves to `5.4.624` and pulls in `@napi-rs/canvas` as an optional native dependency. The code includes defensive polyfills for `DOMMatrix` and graceful degradation when `standard_fonts` cannot be resolved, which is good. However, `@napi-rs/canvas` can fail in restricted CI/build environments or cross-compilation scenarios.

## 3. Top 5 risks and gaps

### Risk 1 — Root pnpm overrides are silently ignored (HIGH)

**Impact:** On lockfile regeneration, the monorepo loses enforced React/Redux versions. This can cause type/runtime regressions in `surfaces/ai.allternit.com` and other apps, and CI will not catch it until typecheck/build fails elsewhere.

**Evidence:** Every pnpm invocation prints the warning above. The overrides exist only in `package.json`, not in `pnpm-workspace.yaml`.

**Fix:** Move the `overrides` block from `package.json` into `pnpm-workspace.yaml`:

```yaml
overrides:
  '@types/react': ^18.3.28
  '@types/react-dom': ^18.3.1
  '@reduxjs/toolkit': ^2.2.7
  'react-redux': ^9.1.2
  'redux': ^5.0.1
```

Then delete the `pnpm` field from root `package.json`, run `pnpm install --lockfile-only`, and verify the warning disappears.

### Risk 2 — Forked packages ship raw TypeScript source (HIGH)

**Impact:** Packages export `./src/index.ts` directly and have no `build`, `main`, `module`, or `types` fields. Any consumer that is not using tsx/Vite/vitest (e.g. a plain Node service, a compiled Electron main process, or an external package) will fail to resolve them. This also breaks the mental model of a publishable workspace package.

**Evidence:** All four package.json files have `"exports": { ".": "./src/index.ts" }` and no `dist/` or `.d.ts` outputs. Running `pnpm build` at the package level does nothing.

**Fix:** Add a minimal build step to each engine package:

1. `tsc -p tsconfig.build.json` (emit ESM + declarations) or `tsup src/index.ts --dts`;
2. Update `exports` to point at `./dist/index.js` and `./dist/index.d.ts`;
3. Keep `src` available for source-map debugging;
4. Add `"build"` and `"clean"` scripts;
5. Update `tsconfig.json` `include` if necessary (currently includes `src`, `tests`, `scripts`).

This is the highest-impact engineering fix after the pnpm overrides.

### Risk 3 — `office-engine-service` has no tests, build, or deployment config (MEDIUM-HIGH)

**Impact:** The service is a Phase 0 prototype. It typechecks and the endpoints work when run with `tsx`, but there is no automated verification that `/parse`, `/docx/roundtrip`, or `/health` behave correctly, no production build, and no Dockerfile/fly.toml/railway.json for deployment.

**Evidence:** `services/office-engine/` contains only `src/index.ts`, `package.json`, `tsconfig.json`, `scripts/make-fixture.mjs`, and a `tmp/` fixture. No `tests/`, no `Dockerfile`, no deployment manifest.

**Fix:**

1. Add `tests/` with Vitest using `@hono/node-server`’s `serve` + `fetch` (Hono apps expose `app.fetch`, so tests can call it directly without binding a port);
2. Add a `build` script (e.g. `tsc -p tsconfig.build.json` or `esbuild src/index.ts --bundle --platform=node --outfile=dist/index.js`) so the service can run without `tsx` in production;
3. Add a minimal `Dockerfile` or reuse the monorepo’s existing deployment pattern;
4. Add a `start` script that runs the compiled output.

### Risk 4 — Missing GenOffice Apache-2.0 attribution (MEDIUM)

**Impact:** The engine packages are derived from GenOffice (Apache-2.0, Copyright 2026 Mainfunc, Inc.). Apache-2.0 requires preservation of copyright notices and a NOTICE file if one exists. Currently:

* each package.json says `"license": "Apache-2.0"` (correct);
* but the packages contain no `LICENSE`, `NOTICE`, or source-header attribution;
* `THIRD_PARTY_NOTICES.md` at repo root does not mention GenOffice.

This is a license-compliance gap that should be closed before distribution.

**Fix:**

1. Copy/adapt GenOffice’s `LICENSE` and `NOTICE` into each forked package (or add a single `packages/@allternit/office-docx-engine/LICENSE` etc.);
2. Add a GenOffice entry to root `THIRD_PARTY_NOTICES.md` citing the source (https://github.com/genspark-ai/genoffice) and the packages it was used in;
3. Optionally add a short header comment to the top-level `src/index.ts` files noting the GenOffice origin.

### Risk 5 — Vitest/Vite version schism (MEDIUM)

**Impact:** The engine packages pull Vitest 4.x / Vite 8.x into the lockfile while the rest of the repo uses Vitest 1.x / Vite 5.x. This causes:

* duplicated tooling in `node_modules/.pnpm`;
* `@vitest/coverage-v8` peer mismatch warnings;
* confusion about which global `vitest` is used when running from root;
* risk of subtle test-runner behavior differences.

**Evidence:** `pnpm why vite` shows Vite 5.4.21 at root and Vite 8.0.12 under the engine packages. Peer warnings include `vitest 4.1.8` wanting `@vitest/coverage-v8@4.1.8` but finding `1.6.1`.

**Fix:** Align the engine packages with the monorepo’s Vitest version if possible. The two realistic options:

1. **Downgrade engine packages to Vitest 1.x** (and Vite 5.x) to match the rest of the repo. Vitest 1.x supports `moduleResolution: bundler` and TypeScript 5.x; test files should need only minor config changes.
2. **If Vitest 4 features are required**, upgrade the root monorepo to Vitest 4.x and `@vitest/coverage-v8@4.x`. This is a larger blast radius but avoids the schism.

Option 1 is the minimal fix.

## 4. Additional observations

### 4.1 Source-code quality

The forked source code is well-structured and includes thoughtful details:

* `office-pptx-render` uses a clean layered architecture (`coords`, `fill`, `metrics`, `text-layout`, `build-slide`, `build-chart`).
* `office-pptx-engine` includes streaming save (`savePptxToFile`) and commit-save optimizations for large decks.
* `office-file-parse/src/pdf.ts` includes a `DOMMatrix` polyfill and graceful degradation for missing standard fonts in bundled builds.
* No remaining `@genspark/*` or `genspark` references were found in the forked packages or service.

### 4.2 `pnpm-workspace.yaml` `onlyBuiltDependencies`

The list includes `@whiskeysockets/baileys`, `better-sqlite3`, `canvas`, `electron`, `protobufjs`, `sharp`, `sqlite3`. It does **not** include `@napi-rs/canvas` (pulled by `pdfjs-dist`). In environments where pnpm’s `onlyBuiltDependencies` enforcement is strict, `@napi-rs/canvas` may not build automatically. Consider adding it to the list if PDF parsing is required in production.

### 4.3 Root-level scripts do not exercise the engine packages

`pnpm test` at root runs `vitest` from the repo root using `vitest.workspace.ts`, which only includes `tests/vitest.config.ts` (integration/e2e tests). It does **not** run the engine package tests. `pnpm -r test` runs every workspace’s test script but currently fails early on unrelated workspaces (`cmd/gizzi-code/cli-package`). Therefore there is no single reliable command that runs only the office-engine tests in CI.

### 4.4 `surfaces/allternit-extensions/allternit-office-addin`

This package is named `@allternit/office` and uses Vite 6 / Vitest 4, but it does **not** currently depend on the new engine packages. If it is intended to use them in the future, the build/source issues in Risk 2 must be resolved first.

## 5. Recommended next steps (priority order)

1. **Move root `pnpm` overrides into `pnpm-workspace.yaml`** and remove the ignored `pnpm` field from `package.json`. Regenerate the lockfile and verify the warning is gone.
2. **Add build outputs to the four engine packages** (`dist/index.js` + `.d.ts`) and update `exports` to point at the built artifacts. This unblocks production consumers.
3. **Add tests, a build script, and a deployment manifest to `services/office-engine`** so it can graduate from prototype.
4. **Add GenOffice `LICENSE`/`NOTICE` attribution** to the forked packages and to root `THIRD_PARTY_NOTICES.md`.
5. **Resolve the Vitest/Vite version split** by either downgrading the engine packages to Vitest 1.x or upgrading the root monorepo, to reduce lockfile duplication and peer warnings.

## 6. Conclusion

The GenOffice → Allternit fork integration is functionally sound at the package level: the code compiles, tests pass, and the prototype service responds. The remaining work is mostly **operational and compliance hygiene**: moving pnpm config, adding build steps, testing/deploying the service, preserving Apache-2.0 attribution, and reconciling Vitest versions. Addressing the top two items (pnpm overrides and build outputs) will remove the biggest blockers to production use.
