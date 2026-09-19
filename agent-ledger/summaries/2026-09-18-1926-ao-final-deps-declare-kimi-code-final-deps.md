# ao/final-deps-declare — undeclared-deps sweep, FINAL lane (PR #624)

**Date:** 2026-09-18 1926 · **Agent:** kimi-code · **Branch:** ao/final-deps-declare · **PR:** #624 merged `ac0776f3f`

## What was done

Final lane of the repo-wide undeclared-deps sweep (siblings already landed: ssh-bridge #614, landmines #620, platform/sdk #621, gizzi-code #623). Every import was verified on `origin/main @ 3f931ceb9` before declaring; versions come from pnpm-lock.yaml resolved entries. No runtime source changed except a one-line require fix — all other changes are package.json manifests + lockfile.

### Surfaces (commit 3567078e4)
- **office.allternit.com**: `pdfjs-dist ^5.4.54` (→ 5.4.624) — `pdfjs-dist/build/pdf.worker.mjs?url` import in src/main.tsx. Verified in the installed package: `build/pdf.worker.mjs` exists on disk and the package has no exports map, so the vite `?url` subpath import resolves.
- **allternit-desktop**: `get-windows ^9.3.0` declared as **optionalDependencies** (not dependencies) — src/main/window-below.ts:155 loads it through a guarded `createRequire` with a staged-copy fallback and returns a graceful failure object; a macOS build must not hard-require it.
- **allternit-extension nested packages**:
  - website: `vite ^5.4.21`, `@vitejs/plugin-react-swc ^3.9.0`, `@tailwindcss/vite ^4.0.0`, `dotenv ^16.4.5` — all imported unconditionally by vite.config.js (plugin-react-swc was entirely absent from the lockfile; picked the 3.x line matching the vite-5 major used by sibling page-agent packages). **zod deliberately NOT declared**: its only appearance in the website package is inside a docs code-string example (`code={`import { z } from 'zod/v4'`}`), not a real import.
  - packages/extension: `@tailwindcss/vite ^4.0.0` (wxt.config.js).
  - page-agent: `dotenv ^16.4.5` (vite.iife.config.js — chalk was already declared). page-controller + ui: `chalk ^5.6.2` (vite.config.js console logging).
  - allternit-extension root: `vitest ^4.1.8` (2 test files, `vitest run` script; same version the office-addin in the same tree already uses).
  - office-addin + native-host: `playwright ^1.58.2` devDep (test-real-e2e*.mjs / browser-mode-smoke.mjs only).

### Root + infra (commit 2839703cd)
- Root devDependencies (scripts only): `pdf-lib ^1.17.1`, `pptxgenjs ^4.0.1`, `sharp ^0.34.5`, `axios ^1.20.0`, `simple-icons ^16.12.0`, `better-sqlite3 ^13.0.3` (also pinned by the root override), `jsdom ^24.1.3`, `ws ^8.20.0`.
- **eslint + @eslint/js** (undeclared since PR #588 made eslint.config.js loadable): eslint pinned **exact 10.10.0** — `^10.10.0` resolved to 10.11.0 and re-suffixed the entire docusaurus/mintlify eslint peer trees (~40 lockfile entries of pure churn), so the exact pin keeps the lockfile's existing peer instance. **`@eslint/js ^10.0.1`**: the sweep plan assumed a matching 10.10.0, but the registry has no `@eslint/js@10.10.0` (latest is 10.0.1; verified via `pnpm view`) — 10.0.1 peers `eslint ^10.0.0`, which covers 10.10.0.
- **allternit-browser**: `zod ^3.25.76` (src/browser/routes/protocol.ts, zod v3 API; ws/express/sharp/playwright were already declared).
- **allternit-dak-runner**: `ws ^8.20.0` — dominant locked 8.x; direct-operator.ts uses the ws 8.x API (`WebSocketServer` + client `WebSocket`, `.on('connection'|'message'|'close')`), verified against the installed 8.20.0.
- **vault-viewer/web**: `@lezer/highlight ^1.2.3` runtime dep (Preview.tsx:2, lib/highlight.ts:2).
- plugin-sdk/website `prism-react-renderer ^2.0.0` — already declared; skipped.

### Portability fix (commit 08dfa8f0c)
`scripts/audit/inspect-model-lab.cjs:1` did `require('~/Desktop/allternit-workspace/allternit/node_modules/ws')` — an absolute machine path that only resolves on this one Mac. Changed to bare `require('ws')` (now declared in root devDeps). The script uses the ws 8.x client API (`new WebSocket(url)`, `socket.send`, `socket.on('open'|'message')`), matching the declared version.

## Lockfile

Regenerated with `pnpm install --lockfile-only`. First attempt used `@eslint/js ^10.10.0` → ERR_PNPM_NO_MATCHING_VERSION (registry-authoritative, see above). Remaining churn is strictly mechanical: the get-windows dependency tree and the `@swc/core@1.16.2` auto-installed optional peer (from @vitejs/plugin-react-swc; `autoInstallPeers: true`) which re-suffixes a few ts-node/jest entries in the mintlify tree. No unrelated dedupes.

## Verification (all green)

- `pnpm install --frozen-lockfile` exit 0
- office.allternit.com `typecheck` (tsc --noEmit) exit 0
- extension website `build:website` (vite build) exit 0 — proves vite + @vitejs/plugin-react-swc + @tailwindcss/vite + dotenv all resolve and build
- allternit-extension `vitest run`: 2 files / 19 tests passed — proves the vitest declaration
- allternit-dak-runner, allternit-browser, vault-viewer/web typechecks exit 0
- `node scripts/release-preflight.mjs`: **52 passed, 0 failed**
- `node --check scripts/audit/inspect-model-lab.cjs`: parses

## Incidents / notes

- Overwrote `.steering/checkpoint.md` while updating the checkpoint, then restored the prior sessions' content from HEAD and prepended mine (git-tracked file; verified 1-file diff after restore). The checkpoint change was intentionally NOT committed — it is worktree scratch and died with the worktree teardown.
- `@eslint/js@10.10.0` does not exist (plan assumed it did); used ^10.0.1.

## Honest deferrals

None. Long builds intentionally not run (desktop electron build, addin vite build) — these manifests only add optional/dev deps; release-desktop.yml untouched per plan, and release-preflight 52/0 covers the release path.
