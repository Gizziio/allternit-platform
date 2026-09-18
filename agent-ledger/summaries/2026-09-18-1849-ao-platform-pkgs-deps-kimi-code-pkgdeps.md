# ao/platform-pkgs-deps — platform/sdk undeclared-dep declarations

- **Date:** 2026-09-18 18:49 CDT
- **Agent:** kimi-code (resumed a timed-out prior session that left 6 dirty files / 0 commits in worktree `allternit-ao-pkgdeps`)
- **Branch:** `ao/platform-pkgs-deps`
- **PR:** #621 — merged as `b859e841a13dbafc87ba168656ed0e59a787c6f3` (merge commit)

## What was done

Declared imports that were used but not declared, per the repo-wide undeclared-deps sweep:

- `platform/packages/office-sheets-app`: `@univerjs/engine-formula`, `@univerjs/sheets`, `@univerjs/sheets-ui` — all `^0.25.1`, matching existing univerjs pins (importer uses them in `src/renderer/*`).
- `platform/packages/office-slides-app`: `opentype.js ^2.0.0`, `acorn ^8.16.0`, `undici ^5.29.0`. acorn pinned to ^8, **not** the ^7 the sweep first suggested: `src/renderer/ai/layout-script-interpreter.ts` uses `ecmaVersion: 'latest'`, which exists only in acorn 8 (type union and runtime). acorn@8.16.0 was already in the pnpm store, so the switch added zero lockfile churn.
- `platform/types/schemas`: `zod ^3.25.76` (used by `UI_CONTRACTS_*.ts`).
- `sdk/allternit-sdk`: `zod-to-json-schema ^3.20.4`, `jszip ^3.10.1` as dependencies; `vitest ^0.34.6` as devDependency (imports in `src/ai-runtime/**`).

Dropped during rebase onto main: plugin-sdk langchain optional peer (already landed via `ao/dep-landmines` 7751c9d99) and plugin-sdk/website prism-react-renderer (already declared there). Not touched per sweep scope: `platform/packages/ix`, `cmd/gizzi-code`.

## Lockfile approach

`pnpm install --lockfile-only` regenerated from origin/main after resolving conflicts — final diff strictly the affected importer blocks + one `zod-to-json-schema` snapshot (37+/1−). No `@babel/core` peer-variant churn. `pnpm install --frozen-lockfile` exits 0.

## Verification evidence

- `npx tsc --noEmit` — office-sheets-app, office-slides-app, plugin-sdk: all exit 0 (types/schemas and allternit-sdk have no tsconfig).
- `node scripts/release-preflight.mjs` — 52 passed, 0 failed.

## Incidents / deferrals

- Prior session's `acorn ^7.4.1` guess broke `office-slides-app` typecheck (TS2322 on `ecmaVersion: 'latest'`); fixed by pinning ^8.16.0. No other incidents.
- Nothing deferred. `platform/packages/ix` remains undeclared-deps territory pending its separate decision, per sweep scope.
