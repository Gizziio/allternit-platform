# Attestation — session/3a37a822-p6: open-connector as a bundled, ephemeral-port sidecar

- Date: 2026-09-10
- Session: 3a37a822 (kimi), phase 6
- Branch: `session/3a37a822-p6` → PR #253, merged as `3f4dd36fcb` (merge commit)
- Scope: `services/open-connector/` (server entry + runtime store), `surfaces/allternit-desktop/` (manager, auth-manager, unified-main, prepare/verify scripts, package.json, .gitignore), `.github/workflows/release-desktop.yml`, `scripts/release-preflight.mjs`, `pnpm-lock.yaml` (esbuild devDep)

## Why

Owner directive after the PR #244 crash-loop fix: open-connector must ship in
the app, but not run the way it did (dev-server pattern: loose TS source +
copied node_modules + fixed port 8014 + infinite respawn). This PR implements
the production shape proposed and agreed in the session:

1. **Single esbuild bundle** instead of src/ + node_modules copy.
   `prepare-connector-sidecar.cjs` now runs `npm ci` in open-connector only
   when its node_modules is missing/stale, regenerates the registry/catalog,
   and bundles `src/server/index.ts` → `resources/connector-sidecar/dist/server.mjs`
   (ESM, node20 target, createRequire banner for CJS deps like pino; top-level
   await in the server makes ESM the only viable format). 22.8MB, sha256
   logged, runtime markers verified (`allternitAnnounce`,
   `connect server listening`, `node:sqlite`). esbuild ^0.25.0 added as a
   desktop devDependency. extraResources now copies only catalog/,
   migrations/, and dist/ — no source tree, no node_modules.
2. **Ephemeral port + stdout announce.** Server emits a JSON line
   `{allternitAnnounce:"listening",port}` when `OOMOL_CONNECT_ANNOUNCE_PORT=1`;
   the manager binds PORT=0, parses the announce, health-probes /health on the
   real port before declaring Ready. EADDRINUSE crash loops are structurally
   impossible; dev LaunchAgents/second instances can no longer starve the app
   of 8014.
3. **Bounded supervision.** Exponential backoff 1s→16s, max 5 crash restarts,
   then status `degraded` surfaced to the splash through `onDegraded` →
   `serviceState.connector`. Never a silent infinite respawn.
4. **Boot reorder.** Connector starts before gizzi-code and allternit-api so
   `authManager.getConnectorSidecarEnvironment()` hands both processes the
   real announced URL (both previously hard-coded 8014 via env).
5. **Bundle-context path overrides.** `OOMOL_CONNECT_CATALOG_DIR` and
   `OOMOL_CONNECT_MIGRATIONS_DIR` env vars in open-connector (catalog was
   cwd-relative; migrations used import.meta.url — both break inside a
   single bundled file). OSS defaults unchanged.
6. **Gates.** verify-packaged-resources.cjs hard-fails on missing/stale
   bundle; release-preflight checkSidecarGuards tracks the new gate;
   CI prepare step renamed to "Build open-connector sidecar bundle".

## Verification

- Standalone bundle smoke (system node, temp data dir): announced ephemeral
  port 63680, /health 200, authed /v1/apps (200) and /v1/actions/search
  (200), and a **live no-auth action execution** —
  `POST /v1/actions/hackernews.get_top_stories` returned real Hacker News
  story IDs — exercising the 1065 lazy dynamic executor imports inside the
  single file (the highest-risk bundle area).
- `node scripts/release-preflight.mjs` → **35 passed, 0 failed**.
- Desktop vitest → **125/125**. Desktop tsc (main + preload) clean.
- open-connector `npm run fix-check` clean (oxlint + oxfmt + typecheck).
  NOTE: fix-check's oxfmt reformatted several unrelated provider files
  (android_bridge, generic_email, PROVENANCE.md); those were reverted —
  the committed diff touches only the intended files.
- verify gate on the staged bundle: "Connector sidecar bundle (22.8 MB,
  markers ok)".

## Honest notes / deferred

- Bundle size is 22.8MB (all 1065 provider executor modules + deps inlined,
  lazily executed). Native esbuild binary comes from the desktop
  devDependency; CI jobs already install desktop deps before the prepare
  step, so bundling needs no extra setup.
- `verify-packaged-resources.cjs` still checks the source catalog dir under
  services/open-connector (packaging input), which is correct; the bundle
  marker check guards the staged artifact.
- A manual "restart connector" UI control is not wired; the manager exposes
  `restart()` for a future IPC. After degraded, the owner currently restarts
  the app.
- Voice PyInstaller gate and other PR #244 checks are untouched and still
  green.
